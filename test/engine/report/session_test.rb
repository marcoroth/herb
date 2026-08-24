# frozen_string_literal: true

require_relative "../../test_helper"

module Engine
  class ReportSessionTest < Minitest::Spec
    before do
      Herb::Engine::Report::Session.reset!
    end

    after do
      Herb::Engine::Report::Session.reset!
    end

    def diagnostic(message: "m", code: "c")
      Herb::Diagnostic.new(
        template: "app/views/a.html.erb",
        message: message,
        code: code,
        origin: "Herb Compiler",
        location: Herb::Location.from(1, 0, 1, 4)
      )
    end

    test "records outside a scope, so a producer never has to guard its calls" do
      Herb::Engine::Report::Session.record(diagnostic)

      assert_equal 1, Herb::Engine::Report::Session.current.diagnostics.length
      refute_predicate Herb::Engine::Report::Session, :scoped?
    end

    test "collects what was recorded during a capture" do
      session = Herb::Engine::Report::Session.capture do
        Herb::Engine::Report::Session.record(diagnostic(message: "inside"))
      end

      assert_equal ["inside"], session.diagnostics.map(&:message)
      assert_predicate session, :scoped?
    end

    test "closes the scope when the capture ends" do
      Herb::Engine::Report::Session.capture { nil }

      refute_predicate Herb::Engine::Report::Session, :scoped?
    end

    test "gives the outer session back after a nested one, rather than discarding it" do
      outer = Herb::Engine::Report::Session.capture do
        Herb::Engine::Report::Session.record(diagnostic(code: "outer"))

        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.record(diagnostic(code: "inner"))
        end

        Herb::Engine::Report::Session.record(diagnostic(code: "outer-again"))
      end

      assert_equal ["outer", "outer-again"], outer.diagnostics.map(&:code)
    end

    test "keeps a nested session's findings out of the outer one" do
      inner = nil

      Herb::Engine::Report::Session.capture do
        inner = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.record(diagnostic(code: "inner"))
        end
      end

      assert_equal ["inner"], inner.diagnostics.map(&:code)
    end

    test "restores the scope even when the block raises" do
      assert_raises(RuntimeError) do
        Herb::Engine::Report::Session.capture { raise "boom" }
      end

      refute_predicate Herb::Engine::Report::Session, :scoped?
    end

    test "carries sources through to the payload" do
      session = Herb::Engine::Report::Session.capture do
        Herb::Engine::Report::Session.record(diagnostic)
        Herb::Engine::Report::Session.source("app/views/a.html.erb", "<div></div>\n")
      end

      assert_equal({ "app/views/a.html.erb" => "<div></div>\n" }, session.report.to_h[:sources])
    end

    test "is empty until something is recorded" do
      session = Herb::Engine::Report::Session.capture { nil }

      assert_predicate session, :empty?
    end

    describe "open and close, for somewhere a block will not reach" do
      test "collects between the two calls" do
        session = Herb::Engine::Report::Session.open
        Herb::Engine::Report::Session.record(diagnostic)
        Herb::Engine::Report::Session.close

        assert_equal 1, session.diagnostics.length
        refute_predicate Herb::Engine::Report::Session, :scoped?
      end

      test "nests the same way capture does" do
        outer = Herb::Engine::Report::Session.open
        inner = Herb::Engine::Report::Session.open

        Herb::Engine::Report::Session.record(diagnostic(code: "inner"))
        Herb::Engine::Report::Session.close

        Herb::Engine::Report::Session.record(diagnostic(code: "outer"))
        Herb::Engine::Report::Session.close

        assert_equal ["inner"], inner.diagnostics.map(&:code)
        assert_equal ["outer"], outer.diagnostics.map(&:code)
      end

      test "closing when nothing is open leaves nothing open" do
        assert_nil Herb::Engine::Report::Session.close
        refute_predicate Herb::Engine::Report::Session, :scoped?
      end
    end

    test "does not leak between threads" do
      Herb::Engine::Report::Session.record(diagnostic)

      other = Thread.new { Herb::Engine::Report::Session.current.diagnostics.length }.value

      assert_equal 0, other
      assert_equal 1, Herb::Engine::Report::Session.current.diagnostics.length
    end

    test "a thread spawned while a session is open records into its own" do
      session = Herb::Engine::Report::Session.open

      Thread.new { Herb::Engine::Report::Session.record(diagnostic(code: "background")) }.join

      assert_empty session.diagnostics
    end

    test "reaches a render happening in a fiber, the way a streaming response renders" do
      session = Herb::Engine::Report::Session.open

      Fiber.new { Herb::Engine::Report::Session.record(diagnostic(code: "streamed")) }.resume

      assert_equal ["streamed"], session.diagnostics.map(&:code)
      refute_predicate session, :empty?
    end

    test "a session opened inside a fiber does not escape it" do
      session = Herb::Engine::Report::Session.open

      Fiber.new { Herb::Engine::Report::Session.open }.resume

      assert_same session, Herb::Engine::Report::Session.current
    end

    test "a ractor collects into its own, even reaching the one in fiber storage" do
      session = Herb::Engine::Report::Session.open
      Herb::Engine::Report::Session.record(diagnostic(code: "main"))

      ractor = Ractor.new do
        klass = Herb::Engine::Report::Session

        reached = !Fiber[klass::STATE_KEY].nil?
        refused = klass.stored.nil?

        klass.record(Herb::Diagnostic.new(template: "app/views/a.html.erb", message: "m", code: "ractor"))

        [reached, refused, klass.current.diagnostics.map(&:code)]
      end

      reached, refused, collected = ractor.value

      assert reached, "expected fiber storage to still be inherited into the ractor"
      assert refused, "expected the inherited session to be refused"
      assert_equal ["ractor"], collected
      assert_equal ["main"], session.diagnostics.map(&:code)
    end

    describe "attributing what happens to the tag that caused it" do
      def session_with_frames
        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 3, 7) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            Herb::Engine::Report::Session.observe(:queries, "SELECT 2")
          end

          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 3")
          end
        end
      end

      test "keeps each position apart" do
        entries = session_with_frames.entries

        assert_equal([[1, 0], [3, 7]], entries.map { |entry| [entry.line, entry.column] })
        assert_equal 1, entries.first[:queries].length
        assert_equal 2, entries.last[:queries].length
      end

      test "orders them the way they appear in the template" do
        assert_equal [1, 3], session_with_frames.entries.map(&:line)
      end

      test "drops what happens outside any tag" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
        end

        assert_empty session.entries
      end

      test "attributes to the innermost tag" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.at("a.html.erb", 2, 4) do
              Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            end
          end
        end

        assert_equal([[2, 4]], session.entries.map { |entry| [entry.line, entry.column] })
      end

      test "leaves the frame even when the tag raises" do
        session = Herb::Engine::Report::Session.capture do
          begin
            Herb::Engine::Report::Session.at("a.html.erb", 1, 0) { raise "boom" }
          rescue RuntimeError
            nil
          end

          Herb::Engine::Report::Session.observe(:queries, "after the failure")
        end

        assert_empty session.entries
      end

      test "turns what one tag observed into a metric carrying a badge and no severity" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 7, 8) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
            Herb::Engine::Report::Session.observe(:queries, "SELECT 2")
          end
        end

        diagnostic = session.measure(:queries, origin: "Herb Engine", code: "sql-queries") { |queries|
          "#{queries.size} SQL queries"
        }.first

        assert_equal "2 SQL queries", diagnostic.value
        assert_equal :metric, diagnostic.kind
        assert_nil diagnostic.severity
        assert_equal "a.html.erb", diagnostic.template
        assert_equal 7, diagnostic.location.start.line
        assert_equal ["SELECT 1", "SELECT 2"], diagnostic.data[:queries]
      end

      test "measures only the tags that observed something" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.observe(:renders, "partial")
          end

          Herb::Engine::Report::Session.at("a.html.erb", 2, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        measured = session.measure(:queries, origin: "Herb Engine") { |queries| queries.size.to_s }

        assert_equal [2], measured.map { |diagnostic| diagnostic.location.start.line }.sort
      end

      test "puts what it measured into the payload" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        session.measure(:queries, origin: "Herb Engine", code: "sql-queries") { |queries|
          "#{queries.size} SQL query"
        }

        assert_equal "1 SQL query", JSON.parse(session.report.to_json)["diagnostics"].first["message"]
      end

      test "reports every tag still rendering, innermost first" do
        stack = nil

        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("layouts/application.html.erb", 2, 2) do
            Herb::Engine::Report::Session.at("posts/index.html.erb", 4, 4) do
              Herb::Engine::Report::Session.at("posts/_card.html.erb", 1, 2) do
                stack = Herb::Engine::Report::Session.stack
              end
            end
          end
        end

        assert_equal [
          ["posts/_card.html.erb", 1, 2],
          ["posts/index.html.erb", 4, 4],
          ["layouts/application.html.erb", 2, 2]
        ], stack
      end

      test "writes an entry the way an editor would take it" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("app/views/posts/_card.html.erb", 3, 8) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        assert_equal "app/views/posts/_card.html.erb:3:9 (1 queries)", session.entries.first.to_s
      end

      test "writes a tag with no location of its own as the first line" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("app/views/posts/_card.html.erb", 0, 0) do
            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        assert_equal "app/views/posts/_card.html.erb:1:1 (1 queries)", session.entries.first.to_s
      end

      test "reports an empty stack outside of any tag" do
        assert_empty Herb::Engine::Report::Session.capture { nil }.stack
      end

      test "hands out a stack that cannot be used to corrupt the live one" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
            Herb::Engine::Report::Session.stack.each(&:clear)

            Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
          end
        end

        entry = session.entries.first

        assert_equal ["a.html.erb", 1, 0], [entry.template, entry.line, entry.column]
      end

      test "collects a tag reached twice in one render into one entry" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("a.html.erb") do
            2.times do
              Herb::Engine::Report::Session.at("a.html.erb", 1, 0) do
                Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
              end
            end
          end
        end

        assert_equal 1, session.entries.length
        assert_equal 2, session.entries.first[:queries].length
      end

      test "keeps two renders of the same partial apart" do
        session = Herb::Engine::Report::Session.capture do
          2.times do
            Herb::Engine::Report::Session.render("_card.html.erb") do
              Herb::Engine::Report::Session.at("_card.html.erb", 1, 5) do
                Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
              end
            end
          end
        end

        assert_equal 2, session.entries.length
        counts = session.entries.map { |entry| entry[:queries].length }

        assert_equal [1, 1], counts
      end

      test "gives each of them its own metric rather than one summed one" do
        session = Herb::Engine::Report::Session.capture do
          2.times do
            Herb::Engine::Report::Session.render("_card.html.erb") do
              Herb::Engine::Report::Session.at("_card.html.erb", 1, 5) do
                Herb::Engine::Report::Session.observe(:queries, "SELECT 1")
              end
            end
          end
        end

        measured = session.measure(:queries, origin: "Herb Engine") { |queries| "#{queries.size} SQL queries" }

        assert_equal ["1 SQL queries", "1 SQL queries"], measured.map(&:value)
      end
    end

    describe "annotating a render" do
      test "gives every occurrence of a template its own node" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("index.html.erb") do
            2.times do
              Herb::Engine::Report::Session.render("_card.html.erb") do
                Herb::Engine::Report::Session.annotate(:queries, 3, origin: "Herb Engine")
              end
            end
          end
        end

        assert_equal ["2", "3"], session.report.nodes.keys
        assert_equal({ "Herb Engine" => { queries: 3 } }, session.report.nodes["2"])
      end

      test "says where in the parent each render was called from" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("index.html.erb") do
            Herb::Engine::Report::Session.at("index.html.erb", 3, 4) do
              Herb::Engine::Report::Session.render("_card.html.erb") { nil }
            end
          end
        end

        assert_equal(
          { id: "2", template: "_card.html.erb", parent: "1", line: 3, column: 5 },
          session.report.render_tree.last
        )
      end

      test "tells a diagnostic which render it was recorded during" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("_card.html.erb") do
            Herb::Engine::Report::Session.record(
              Herb::Diagnostic.new(template: "_card.html.erb", message: "This element has a problem.")
            )
          end
        end

        assert_equal "1", session.diagnostics.first.node
      end

      test "leaves a diagnostic recorded outside a render without one" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.record(
            Herb::Diagnostic.new(template: "_card.html.erb", message: "This element has a problem.")
          )
        end

        assert_nil session.diagnostics.first.node
      end

      test "says what kind of render reached each template" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("index.html.erb") do
            Herb::Engine::Report::Session.at("index.html.erb", 3, 4, :collection) do
              Herb::Engine::Report::Session.render("_card.html.erb") { nil }
            end
          end
        end

        assert_equal :collection, session.report.render_tree.last[:via]
      end

      test "leaves out a kind the tag could not name" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("index.html.erb") do
            Herb::Engine::Report::Session.at("index.html.erb", 3, 4) do
              Herb::Engine::Report::Session.render("_card.html.erb") { nil }
            end
          end
        end

        assert_equal [:id, :template, :parent, :line, :column], session.report.render_tree.last.keys
      end

      test "keeps the kind out of the frames it hands back" do
        Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.at("a.html.erb", 1, 0, :partial) do
            assert_equal [["a.html.erb", 1, 0]], Herb::Engine::Report::Session.stack
          end
        end
      end

      test "leaves the call site off a render nothing was rendering" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("index.html.erb") { nil }
        end

        assert_equal({ id: "1", template: "index.html.erb" }, session.report.render_tree.first)
      end

      test "says which render each one happened inside" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("layout.html.erb") do
            Herb::Engine::Report::Session.render("index.html.erb") do
              Herb::Engine::Report::Session.render("_card.html.erb") { nil }
            end
          end
        end

        assert_equal [
          { id: "1", template: "layout.html.erb" },
          { id: "2", template: "index.html.erb", parent: "1" },
          { id: "3", template: "_card.html.erb", parent: "2" }
        ], session.report.render_tree
      end

      test "keeps two producers apart under one render" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("index.html.erb") do
            Herb::Engine::Report::Session.annotate(:render_time, 12.4, origin: "reactionview")
            Herb::Engine::Report::Session.annotate(:queries, 3, origin: "Herb Engine")
          end
        end

        assert_equal(
          { "reactionview" => { render_time: 12.4 }, "Herb Engine" => { queries: 3 } },
          session.report.nodes["1"]
        )
      end

      test "reports the render it is inside of" do
        Herb::Engine::Report::Session.capture do
          assert_nil Herb::Engine::Report::Session.current_node

          Herb::Engine::Report::Session.render("a.html.erb") do
            assert_equal "1", Herb::Engine::Report::Session.current_node
          end

          assert_nil Herb::Engine::Report::Session.current_node
        end
      end

      test "drops an annotation made outside any render rather than inventing a node" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.annotate(:render_time, 1.0, origin: "reactionview")
        end

        assert_empty session.report.nodes
      end

      test "leaves the render even when it raises" do
        session = Herb::Engine::Report::Session.capture do
          begin
            Herb::Engine::Report::Session.render("a.html.erb") { raise "boom" }
          rescue RuntimeError
            nil
          end

          Herb::Engine::Report::Session.annotate(:render_time, 1.0, origin: "reactionview")
        end

        assert_empty session.report.nodes
      end

      test "counts as something worth delivering even with no diagnostics" do
        session = Herb::Engine::Report::Session.capture do
          Herb::Engine::Report::Session.render("a.html.erb") do
            Herb::Engine::Report::Session.annotate(:render_time, 1.0, origin: "reactionview")
          end
        end

        assert_empty session.diagnostics
        refute_predicate session, :empty?
      end
    end
  end
end
