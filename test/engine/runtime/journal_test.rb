# frozen_string_literal: true

require_relative "../../test_helper"

require "tmpdir"
require "json"

require "herb/engine/runtime/journal"

module Engine
  class RuntimeJournalTest < Minitest::Spec
    TEMPLATE = "app/views/posts/_card.html.erb"
    PARENT = "app/views/posts/index.html.erb"
    SOURCE = "<div><%= post.title %></div>"

    around do |test|
      Dir.mktmpdir("herb-journal") do |dir|
        @root = dir
        @journal = Herb::Engine::Runtime::Journal.new(root: dir)

        test.call
      end
    end

    attr_reader :root, :journal

    def digest(source = SOURCE)
      Herb::Fingerprint.template(source)
    end

    def diagnostic(template: TEMPLATE, line: 7, column: 8, end_column: 24, code: "sql-queries", value: "3 SQL queries", **extra)
      Herb::Diagnostic.new(
        template: template, message: value, severity: nil, kind: :metric, origin: "Herb Engine",
        code: code, location: Herb::Location.from(line, column, line, end_column), value: value, **extra
      )
    end

    def report(source: SOURCE, diagnostics: [diagnostic])
      built = Herb::Engine::Runtime::Report.new

      built.render("1", TEMPLATE, nil, digest: digest(source))
      diagnostics.each { |found| built.add(found) }

      built
    end

    def lines_in(path)
      File.readlines(path).map { |line| JSON.parse(line) }
    end

    def journal_file(source = SOURCE)
      journal.path_for(TEMPLATE, digest(source))
    end

    describe "what it writes" do
      test "writes nothing for a report with nothing in it" do
        assert_nil journal.write(Herb::Engine::Runtime::Report.new)
        assert_empty Dir.glob(File.join(root, "**", "*.jsonl"))
      end

      test "names the file after the template and the text it was rendered from" do
        journal.write(report)

        assert_path_exists File.join(root, "journal", "#{TEMPLATE}.#{Herb::Fingerprint.short(digest)}.jsonl")
      end

      test "opens a journal by saying which text it is about" do
        journal.write(report)

        header = lines_in(journal_file).first

        assert_equal "template", header["t"]
        assert_equal digest, header["digest"]
      end

      test "stamps every record with the run it came from and the request that caused it" do
        run = journal.write(report, request: { method: "GET", path: "/posts" })

        record = lines_in(journal_file).find { |line| line["t"] == "finding" }

        assert_equal run, record["run"]
        assert_equal "/posts", record["request_path"]
      end

      test "records where the tag ends, so a reader can mark the tag and not its first character" do
        journal.write(report)

        record = lines_in(journal_file).find { |line| line["t"] == "finding" }

        assert_equal [7, 9], [record["line"], record["column"]]
        assert_equal [7, 25], [record["end_line"], record["end_column"]]
      end

      test "writes one record per occurrence, so the spread survives" do
        3.times { journal.write(report) }

        assert_equal(3, lines_in(journal_file).count { |line| line["t"] == "finding" })
      end

      test "keeps versions of one template apart" do
        journal.write(report)
        journal.write(report(source: "#{SOURCE}\n<p>edited</p>"))

        assert_equal 2, Dir.glob(File.join(root, "journal", "**", "*.jsonl")).length
      end

      test "writes nothing for a template it cannot place inside the journal directory" do
        escaping = Herb::Engine::Runtime::Report.new
        escaping.render("1", "../../etc/passwd", nil, digest: digest)
        escaping.add(diagnostic(template: "../../etc/passwd"))

        journal.write(escaping)

        assert_empty Dir.glob(File.join(root, "journal", "**", "*.jsonl"))
      end

      test "writes nothing for a template whose text it never knew" do
        unknown = Herb::Engine::Runtime::Report.new
        unknown.add(diagnostic)

        journal.write(unknown)

        assert_empty Dir.glob(File.join(root, "journal", "**", "*.jsonl"))
      end

      test "keeps the head of an observation too large to write whole" do
        large = diagnostic(data: { queries: Array.new(500) { |index| "SELECT #{index} FROM #{"x" * 60}" } })

        journal.write(report(diagnostics: [large]))

        record = lines_in(journal_file).find { |line| line["t"] == "finding" }

        assert record["data_trimmed"]
        assert_equal 12, record["data"]["queries"].length
        assert_operator File.readlines(journal_file).last.bytesize, :<=, Herb::Engine::Runtime::Journal::MAX_RECORD_BYTES
      end

      test "drops the oldest records once a journal gets long, and says so" do
        capped = Herb::Engine::Runtime::Journal.new(root: root, max_records: 10)

        14.times { |index| capped.write(report(diagnostics: [diagnostic(value: "#{index} SQL queries")])) }

        records = lines_in(journal_file)

        assert(records.any? { |line| line["t"] == "truncated" })
        assert_operator records.count { |line| line["t"] == "finding" }, :<=, 10
        assert_predicate journal.summary(TEMPLATE, digest), :truncated?
      end

      test "keeps a bounded number of versions of one template" do
        kept = Herb::Engine::Runtime::Journal.new(root: root, kept_digests: 2)

        4.times do |index|
          kept.write(report(source: "#{SOURCE}#{" " * index}"))

          sleep 0.01
        end

        assert_equal 2, Dir.glob(File.join(root, "journal", "**", "*.jsonl")).length
      end

      test "writes down what an observation was without pretending to be it" do
        connection = Class.new { def self.name = "Connection" }.new

        journal.write(report(diagnostics: [diagnostic(data: { queries: [{ sql: "SELECT 1", connection: connection }] })]))

        observed = lines_in(journal_file).find { |line| line["t"] == "finding" }["data"]["queries"].first

        assert_equal "SELECT 1", observed["sql"]
        refute_match(/0x[0-9a-f]+/, observed["connection"])
      end

      test "keeps a value JSON cannot hold, instead of losing the whole write to it" do
        journal.write(report(diagnostics: [diagnostic(data: { timing: [{ duration: Float::INFINITY }] })]))

        record = lines_in(journal_file).find { |line| line["t"] == "finding" }

        assert_equal "Infinity", record["data"]["timing"].first["duration"]
      end

      test "loses one unwritable value instead of the finding it sat in" do
        exploding = Object.new
        exploding.define_singleton_method(:class) { raise "boom" }

        findings = [diagnostic(line: 7, data: { queries: [exploding, "SELECT 1"] }), diagnostic(line: 9, value: "2 SQL queries")]

        journal.write(report(diagnostics: findings))

        recorded = lines_in(journal_file).select { |line| line["t"] == "finding" }

        assert_equal([7, 9], recorded.map { |line| line["line"] })
        assert_equal [nil, "SELECT 1"], recorded.first["data"]["queries"]
      end

      test "never raises into the request it was called from" do
        broken = report

        broken.define_singleton_method(:diagnostics) { raise "boom" }

        assert_nil journal.write(broken)
      end
    end

    describe "what it says about a render tag" do
      def rendered(children_per_parent)
        built = Herb::Engine::Runtime::Report.new
        built.render("1", PARENT, nil, digest: digest)

        id = 1

        children_per_parent.each_with_index do |count, index|
          parent = "p#{index}"

          built.render(parent, PARENT, "1", digest: digest)

          count.times do
            built.render("c#{id += 1}", TEMPLATE, parent, called_from: [PARENT, 3, 4, :partial], digest: digest(SOURCE))
          end
        end

        built.add(diagnostic(template: PARENT))

        built
      end

      def parent_summary
        journal.summary(PARENT, digest)
      end

      test "counts children against the parent render they happened in" do
        journal.write(rendered([3]))

        call = parent_summary.calls.first

        assert_equal({ 3 => 1 }, call.per_parent)
        assert_equal 3, call.peak
      end

      test "tells a loop apart from a partial that simply renders in many parents" do
        journal.write(rendered([1, 1, 1]))

        call = parent_summary.calls.first

        assert_equal({ 1 => 3 }, call.per_parent)
        assert_equal 1, call.peak
      end

      test "merges the histogram across requests instead of summing it away" do
        journal.write(rendered([3]))
        journal.write(rendered([1]))

        call = parent_summary.calls.first

        assert_equal({ 3 => 1, 1 => 1 }, call.per_parent)
        assert_equal 3, call.peak
        assert_equal 2, call.observations
      end

      test "files the call against the parent, since the parent holds the tag a rewrite would edit" do
        journal.write(rendered([2]))

        assert_equal [3], parent_summary.calls.map(&:line)
        assert_empty(journal.summary(TEMPLATE, digest(SOURCE))&.calls || [])
      end

      test "says what the tag resolved to and how often" do
        journal.write(rendered([2]))

        call = parent_summary.calls.first

        assert_equal({ TEMPLATE => 2 }, call.targets)
        assert_equal TEMPLATE, call.only_target
        assert_equal :partial, call.via.to_sym
      end

      test "refuses to name one target when the tag resolved to more than one" do
        built = rendered([1])
        built.render("other", "app/views/posts/_row.html.erb", "p0", called_from: [PARENT, 3, 4, :partial], digest: digest)

        journal.write(built)

        assert_nil parent_summary.calls.first.only_target
      end
    end

    describe "reading it back" do
      test "says nothing about a template nobody rendered" do
        assert_nil journal.summary(TEMPLATE, digest)
      end

      test "says nothing when the text it is asked about is not the text that was rendered" do
        journal.write(report)

        assert_nil journal.summary(TEMPLATE, digest("#{SOURCE}<p>edited</p>"))
      end

      test "says nothing when it is asked without a digest at all" do
        journal.write(report)

        assert_nil journal.summary(TEMPLATE, nil)
      end

      test "folds every occurrence of one finding into one, and counts them" do
        3.times { journal.write(report) }

        findings = journal.summary(TEMPLATE, digest).findings

        assert_equal 1, findings.length
        assert_equal 3, findings.first.observed
      end

      test "reports the spread across requests, which no single request could" do
        journal.write(report(diagnostics: [diagnostic(value: "3 SQL queries")]))
        journal.write(report(diagnostics: [diagnostic(value: "47 SQL queries")]))

        found = journal.summary(TEMPLATE, digest).findings.first

        assert_equal({ min: 3.0, max: 47.0 }, found.range)
        assert_equal "47 SQL queries", found.peak_message
      end

      test "keeps the last few things a tag produced, newest first" do
        journal.write(report(diagnostics: [diagnostic(value: "gamma", data: { output: ["alpha", "beta", "gamma"] })]))
        journal.write(report(diagnostics: [diagnostic(value: "epsilon", data: { output: ["delta", "epsilon"] })]))

        found = journal.summary(TEMPLATE, digest).findings.first

        assert_equal(["epsilon", "delta", "gamma", "beta", "alpha"], found.recent.map { |entry| entry[:value] })
      end

      test "loses a torn write and nothing behind it" do
        journal.write(report)

        File.open(journal_file, "a") { |file| file.write(%({"v":1,"t":"finding","li)) }

        assert_equal 1, journal.summary(TEMPLATE, digest).findings.length
      end

      test "skips a record written by a version it does not know" do
        journal.write(report)

        File.open(journal_file, "a") { |file| file.puts(JSON.generate({ v: 99, t: "finding", line: 1, column: 1 })) }

        assert_equal 1, journal.summary(TEMPLATE, digest).findings.length
      end

      test "lists the versions on disk, so a caller can tell nothing rendered from stale" do
        assert_empty journal.digests(TEMPLATE)

        journal.write(report)

        assert_equal [Herb::Fingerprint.short(digest)], journal.digests(TEMPLATE)
      end

      test "says which requests a finding was seen on" do
        journal.write(report, request: { path: "/posts" })
        journal.write(report, request: { path: "/posts" })
        journal.write(report, request: { path: "/" })

        assert_equal({ "/posts" => 2, "/" => 1 }, journal.summary(TEMPLATE, digest).findings.first.paths)
      end
    end
  end
end
