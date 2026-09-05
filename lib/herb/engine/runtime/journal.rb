# frozen_string_literal: true
# typed: true

require "json"
require "time"
require "fileutils"
require "securerandom"
require "pathname"

require_relative "../../fingerprint"
require_relative "../../visitor/context"
require_relative "observations"
require_relative "journal/summary"

module Herb
  class Engine
    module Runtime
      # What a template did, kept after the request that did it is gone.
      #
      #     journal = Herb::Engine::Runtime::Journal.new(root: "tmp/herb")
      #     journal.write(session.report, request: { method: "GET", path: "/posts" })
      #     journal.summary("app/views/posts/_card.html.erb", digest)
      #
      # A report describes one request and dies with it, which is enough for the browser and no use
      # to an editor. An editor has a file open and wants to know what happened in it, without
      # knowing which request that was or whether the request has been made yet. So this is keyed by
      # what the editor already has, a path and the text at that path:
      #
      #     tmp/herb/journal/app/views/posts/_card.html.erb.9f2a1c4e.jsonl
      #
      # The digest in the name is the whole staleness mechanism. An editor hashes its buffer, builds
      # that path and opens it. A file edited since produces a different name, which does not exist,
      # so a position recorded against text that no longer exists is never shown and nothing has to
      # work out how far an edit moved things.
      #
      # Written the way `Dev::ServerEntry` writes its own registry: a known directory, one file per
      # key, and pruning done by whoever happens to pass by rather than a separate sweep.
      #
      # What accumulates is the point. One request says a partial ran three queries. A journal says
      # it ran between three and forty seven across two hundred renders, which is the shape of an
      # N+1 and is not visible from any one request.
      #
      class Journal
        RECORD_VERSION = 1 #: Integer
        DEFAULT_ROOT = "tmp/herb" #: String
        DIRECTORY = "journal" #: String
        EXTENSION = ".jsonl" #: String
        MAX_RECORDS = 2_000 #: Integer
        MAX_RECORD_BYTES = 4_096 #: Integer
        MIN_RECORD_BYTES = 64 #: Integer
        KEPT_DIGESTS = 5 #: Integer

        attr_reader :root #: Pathname
        attr_reader :max_records #: Integer
        attr_reader :kept_digests #: Integer

        #: (?root: (String | Pathname), ?max_records: Integer, ?kept_digests: Integer) -> void
        def initialize(root: DEFAULT_ROOT, max_records: MAX_RECORDS, kept_digests: KEPT_DIGESTS)
          @root = Pathname.new(root.to_s)
          @max_records = max_records
          @kept_digests = kept_digests
          @collected = {} #: Hash[String, bool]
        end

        #: () -> Pathname
        def directory
          root + DIRECTORY
        end

        #: (String, String) -> Pathname?
        def path_for(template, digest)
          relative = safe_relative_path(template)
          short = Fingerprint.short(digest)

          return nil unless relative && short

          directory + "#{relative}.#{short}#{EXTENSION}"
        end

        #: (Herb::Engine::Runtime::Report, ?request: Hash[Symbol, untyped]?) -> String?
        def write(report, request: nil)
          return nil if report.empty?

          run = mint_run_id
          at = timestamp
          path = request && request[:path]

          lines = Hash.new { |all, key| all[key] = [] } #: Hash[Array[untyped], Array[String]]

          collect_findings(report, lines, run, at, path)
          collect_calls(report, lines, run, at, path)

          lines.each do |(template, digest), records|
            file = path_for(template, digest)

            next unless file

            append(file, header: header_for(template, digest, at), lines: records)
            collect_siblings(file)
          end

          run
        rescue StandardError
          nil
        end

        #: (String, String?) -> Herb::Engine::Runtime::Journal::Summary?
        def summary(template, digest)
          return nil unless digest

          file = path_for(template, digest)

          return nil unless file&.exist?

          Summary.build(template, digest, records_in(file))
        rescue SystemCallError
          nil
        end

        #: (String) -> Array[String]
        def digests(template)
          file = path_for(template, "0" * Fingerprint::SHORT_LENGTH)

          return [] unless file

          base = base_of(file)

          Dir.glob("#{base}.*#{EXTENSION}").sort_by { |found| -File.mtime(found).to_f }.filter_map { |found| found[/\.([0-9a-f]+)#{Regexp.escape(EXTENSION)}\z/, 1] }
        rescue SystemCallError
          []
        end

        private

        #: (Herb::Engine::Runtime::Report, Hash[Array[untyped], Array[String]], String, String, String?) -> void
        def collect_findings(report, lines, run, at, path)
          report.diagnostics.each do |diagnostic|
            digest = report.digest_for(diagnostic.template)

            next unless digest

            line = finding_line(diagnostic, run, at, path)

            lines[[diagnostic.template, digest]] << line if line
          end

          nil
        end

        #: (Herb::Engine::Runtime::Report, Hash[Array[untyped], Array[String]], String, String, String?) -> void
        def collect_calls(report, lines, run, at, path)
          nodes = {} #: Hash[untyped, Hash[Symbol, untyped]]

          report.render_tree.each { |node| nodes[node[:id]] = node }

          report.render_tree.group_by { |node| call_site(nodes, node) }.each do |site, children|
            next unless site

            parent_template, line, column, via = site
            digest = report.digest_for(parent_template)

            next unless digest

            per_parent = children.group_by { |child| child[:parent] }.transform_values(&:size)

            lines[[parent_template, digest]] << encode(
              {
                t: "call",
                at: at,
                run: run,
                request_path: path,
                line: line,
                column: column,
                via: via,
                targets: children.map { |child| child[:template] }.tally,
                parents: per_parent.size,
                renders: children.size,
                per_parent: per_parent.values.tally.transform_keys(&:to_s),
              }.compact
            )
          end

          nil
        end

        #: (Hash[String, Hash[Symbol, untyped]], Hash[Symbol, untyped]) -> Array[untyped]?
        def call_site(nodes, node)
          parent = node[:parent] && nodes[node[:parent]]
          location = node[:location]

          return nil unless parent && location

          [parent[:template], location[:line], location[:column], node[:via]]
        end

        #: (Herb::Diagnostic, String, String, String?) -> String?
        def finding_line(diagnostic, run, at, path)
          location = diagnostic.location
          position = location&.start&.to_one_based

          return nil unless position

          finish = location&.end&.to_one_based

          record = {
            t: "finding",
            at: at,
            run: run,
            request_path: path,
            node: diagnostic.node,
            line: position[:line],
            column: position[:column],
            end_line: finish && finish[:line],
            end_column: finish && finish[:column],
            code: diagnostic.code,
            origin: diagnostic.origin,
            kind: diagnostic.kind,
            severity: diagnostic.severity,
            message: diagnostic.message,
            description: diagnostic.description,
            value: diagnostic.value,
            data: Observations.jsonable(diagnostic.data),
          }.compact

          line = encode(record)

          return line if line.bytesize <= MAX_RECORD_BYTES

          trimmed = encode(record.merge(data: Observations.trim(record[:data]), data_trimmed: true))

          return trimmed if trimmed.bytesize <= MAX_RECORD_BYTES

          encode(record.except(:data))
        rescue StandardError
          nil
        end

        #: (String, String, String) -> String
        def header_for(template, digest, at)
          encode({ t: "template", path: template, digest: digest, first_seen: at })
        end

        #: (Hash[Symbol, untyped]) -> String
        def encode(record)
          JSON.generate({ v: RECORD_VERSION }.merge(record))
        end

        #: (Pathname) -> Array[Hash[String, untyped]]
        def records_in(path)
          path.each_line.filter_map { |line|
            next if line.strip.empty?

            record = begin
              JSON.parse(line)
            rescue JSON::ParserError
              next
            end

            record if record.is_a?(Hash) && record["v"] == RECORD_VERSION
          }
        end

        #: (Pathname, header: String?, lines: Array[String]) -> void
        def append(path, header:, lines:)
          FileUtils.mkdir_p(path.dirname)

          File.open(path, File::RDWR | File::CREAT, 0o644) do |file|
            file.flock(File::LOCK_EX)

            if header && file.stat.zero?
              file.write("#{header}\n")
              file.flush
            end

            compact(file, header) if over_cap?(file)

            file.seek(0, IO::SEEK_END)

            lines.each { |line| file.write("#{line}\n") }

            file.flush
          end

          nil
        end

        #: (File) -> bool
        def over_cap?(file)
          return false if file.size < max_records * MIN_RECORD_BYTES

          file.rewind

          file.each_line.count > max_records
        end

        #: (File, String?) -> void
        def compact(file, header)
          file.rewind

          all = file.each_line.to_a
          first = all.first
          keep_header = header && first&.include?(%("t":"template")) ? first : nil
          records = keep_header ? all.drop(1) : all

          dropped = records.sum { |line| truncated_count(line) }
          kept_lines = records.reject { |line| truncated?(line) }
          kept = kept_lines.last(max_records / 2)
          dropped += kept_lines.size - kept.size

          file.truncate(0)
          file.rewind
          file.write(keep_header) if keep_header
          file.write("#{encode({ t: "truncated", dropped: dropped })}\n")
          kept.each { |line| file.write(line) }

          nil
        end

        #: (String) -> bool
        def truncated?(line)
          line.include?(%("t":"truncated"))
        end

        #: (String) -> Integer
        def truncated_count(line)
          return 0 unless truncated?(line)

          JSON.parse(line)["dropped"].to_i
        rescue JSON::ParserError
          0
        end

        #: (Pathname) -> void
        def collect_siblings(path)
          return if @collected[path.to_s]

          @collected[path.to_s] = true

          base = base_of(path)
          siblings = Dir.glob("#{base}.*#{EXTENSION}").sort_by { |file| -File.mtime(file).to_f }

          siblings.drop(kept_digests).each { |file| File.delete(file) }

          nil
        rescue SystemCallError
          nil
        end

        #: (Pathname) -> String
        def base_of(path)
          path.to_s.sub(/\.[0-9a-f]+#{Regexp.escape(EXTENSION)}\z/, "")
        end

        #: (String?) -> String?
        def safe_relative_path(template)
          return nil if template.nil? || template.empty?
          return nil if template == Herb::Visitor::Context::UNKNOWN_FILE_PATH

          clean = Pathname.new(template).cleanpath

          return nil if clean.absolute?
          return nil if clean.each_filename.include?("..")

          clean.to_s
        end

        #: () -> String
        def mint_run_id
          "#{Time.now.utc.strftime("%Y%m%dT%H%M%S")}-#{SecureRandom.hex(4)}"
        end

        #: () -> String
        def timestamp
          Time.now.utc.iso8601(3)
        end
      end
    end
  end
end
