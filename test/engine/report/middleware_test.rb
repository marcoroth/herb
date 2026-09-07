# frozen_string_literal: true

require_relative "../../test_helper"

require "tmpdir"
require "json"

require "herb/engine/runtime/journal"

module Engine
  class ReportMiddlewareTest < Minitest::Spec
    PAGE = "<html><body><h1>Hello</h1></body></html>"

    before do
      Herb::Engine::Runtime::Session.reset!
    end

    after do
      Herb::Engine::Runtime::Session.reset!
    end

    class Marker
      def initialize(anchor, entry)
        @anchor = anchor
        @entry = entry
      end

      attr_reader :anchor #: Symbol

      def empty? = false
      def to_html = "<!--#{@entry}-->"
    end

    def diagnostic(message: "Something is wrong.")
      Herb::Diagnostic.new(
        template: "app/views/a.html.erb",
        message: message,
        code: "InvalidNestingError",
        origin: "Herb Compiler",
        location: Herb::Location.from(1, 0, 1, 4)
      )
    end

    def app(body: PAGE, headers: { "content-type" => "text/html; charset=utf-8" }, status: 200, &block)
      lambda { |_env|
        block&.call

        [status, headers, Array(body)]
      }
    end

    def call(app, inject: true)
      Herb::Engine::Runtime::Middleware.new(app, inject: inject).call({})
    end

    def body_of(response)
      buffer = +""

      response[2].each { |chunk| buffer << chunk }

      buffer
    end

    describe "handing the session back" do
      test "leaves the session it used in the env" do
        env = {}

        Herb::Engine::Runtime::Middleware.new(app { Herb::Engine::Runtime::Session.record(diagnostic) }).call(env)

        session = env[Herb::Engine::Runtime::Middleware::ENV_KEY]

        assert_instance_of Herb::Engine::Runtime::Session, session
        assert_equal ["Something is wrong."], session.diagnostics.map(&:message)
      end

      test "collects into a session that was already open rather than one nobody can reach" do
        session = Herb::Engine::Runtime::Session.capture do
          call(app {
            Herb::Engine::Runtime::Session.at("app/views/a.html.erb", 3, 4) do
              Herb::Engine::Runtime::Session.observe(:queries, "SELECT 1")
            end
          })
        end

        assert_equal 1, session.entries.length
        assert_equal ["SELECT 1"], session.entries.first[:queries]
      end

      test "leaves a borrowed session open for whoever opened it" do
        Herb::Engine::Runtime::Session.capture do
          call(app { Herb::Engine::Runtime::Session.record(diagnostic) })

          assert_predicate Herb::Engine::Runtime::Session, :scoped?
        end
      end

      test "still opens its own session when nobody else has one" do
        call(app { Herb::Engine::Runtime::Session.record(diagnostic) })

        refute_predicate Herb::Engine::Runtime::Session, :scoped?
      end

      test "survives an env that cannot be written to" do
        response = Herb::Engine::Runtime::Middleware.new(
          app { Herb::Engine::Runtime::Session.record(diagnostic) }
        ).call(nil)

        assert_includes body_of(response), "data-herb-diagnostics"
      end
    end

    test "injects the payload before the closing body tag" do
      response = call(app { Herb::Engine::Runtime::Session.record(diagnostic) })
      body = body_of(response)

      assert_includes body, 'data-herb-diagnostics data-count="1"'
      assert_match(%r{#{Regexp.escape(%(</script>))}</body>}, body)
    end

    test "leaves a response alone when nothing was found" do
      response = call(app)

      assert_equal PAGE, body_of(response)
    end

    test "leaves a response alone when injection is off" do
      response = call(app { Herb::Engine::Runtime::Session.record(diagnostic) }, inject: false)

      assert_equal PAGE, body_of(response)
    end

    test "leaves a response that is not HTML alone" do
      json = app(body: %({"ok":true}), headers: { "content-type" => "application/json" }) do
        Herb::Engine::Runtime::Session.record(diagnostic)
      end

      assert_equal %({"ok":true}), body_of(call(json))
    end

    test "leaves HTML without a closing body tag alone" do
      fragment = app(body: "<div>partial</div>") { Herb::Engine::Runtime::Session.record(diagnostic) }

      assert_equal "<div>partial</div>", body_of(call(fragment))
    end

    test "finds the content type whatever case the header is in" do
      response = call(
        app(headers: { "Content-Type" => "text/html" }) do
          Herb::Engine::Runtime::Session.record(diagnostic)
        end
      )

      assert_includes body_of(response), "data-herb-diagnostics"
    end

    test "corrects the content length it just changed" do
      headers = { "content-type" => "text/html", "content-length" => PAGE.bytesize.to_s }
      response = call(app(headers: headers) { Herb::Engine::Runtime::Session.record(diagnostic) })

      assert_equal body_of(response).bytesize.to_s, response[1]["content-length"]
    end

    test "leaves a file-backed response alone rather than buffering it" do
      streamed = Object.new

      def streamed.each
        yield("<html><body></body></html>")
      end

      def streamed.to_path
        "/tmp/some-file.html"
      end

      response = call(
        lambda { |_env|
          Herb::Engine::Runtime::Session.record(diagnostic)

          [200, { "content-type" => "text/html" }, streamed]
        }
      )

      assert_same streamed, response[2]
    end

    test "returns the original response when injecting goes wrong" do
      broken = Object.new

      def broken.each(*)
        raise "cannot read this body"
      end

      response = call(
        lambda { |_env|
          Herb::Engine::Runtime::Session.record(diagnostic)

          [200, { "content-type" => "text/html" }, broken]
        }
      )

      assert_same broken, response[2]
    end

    test "closes the session, so one request's findings do not reach the next" do
      call(app { Herb::Engine::Runtime::Session.record(diagnostic) })

      assert_empty Herb::Engine::Runtime::Session.current.diagnostics
    end

    test "keeps each request's findings to itself" do
      first = call(app { Herb::Engine::Runtime::Session.record(diagnostic(message: "first")) })
      second = call(app { Herb::Engine::Runtime::Session.record(diagnostic(message: "second")) })

      assert_includes body_of(first), "first"
      refute_includes body_of(second), "first"
    end

    DOCUMENT = "<html><head><title>t</title></head><body><h1>Hello</h1></body></html>"

    describe "channels" do
      def respond_with(document = DOCUMENT, &collect)
        app = lambda { |_env|
          collect&.call

          [200, { "content-type" => "text/html" }, [document]]
        }

        Herb::Engine::Runtime::Middleware.new(app).call({}).last.first
      end

      test "writes a channel before the tag it asked for" do
        html = respond_with do
          Herb::Engine::Runtime::Session.current.channel(:head) { Marker.new(:head, "h") }
        end

        assert_equal "<html><head><title>t</title><!--h--></head><body><h1>Hello</h1></body></html>", html
      end

      test "writes a body channel before the closing body tag" do
        html = respond_with do
          Herb::Engine::Runtime::Session.current.channel(:body) { Marker.new(:body, "b") }
        end

        assert_equal "<html><head><title>t</title></head><body><h1>Hello</h1><!--b--></body></html>", html
      end

      test "writes every channel it was given" do
        html = respond_with do
          Herb::Engine::Runtime::Session.current.channel(:head) { Marker.new(:head, "h") }
          Herb::Engine::Runtime::Session.current.channel(:body) { Marker.new(:body, "b") }
        end

        assert_equal "<html><head><title>t</title><!--h--></head><body><h1>Hello</h1><!--b--></body></html>", html
      end

      test "leaves a channel alone when the response has no tag for it" do
        html = respond_with("<div>no document here</div>") do
          Herb::Engine::Runtime::Session.current.channel(:head) { Marker.new(:head, "h") }
        end

        assert_equal "<div>no document here</div>", html
      end

      test "leaves a channel alone when it asked for a tag nobody writes before" do
        html = respond_with do
          Herb::Engine::Runtime::Session.current.channel(:nowhere) { Marker.new(:nowhere, "n") }
        end

        assert_equal DOCUMENT, html
      end

      test "returns the response untouched when nothing collected" do
        assert_equal DOCUMENT, respond_with
      end
    end

    describe "handing the session to a journal" do
      after do
        Herb::Engine::Runtime::Middleware.journal = nil
        Herb::Engine::Runtime::Session.clear_measurements
      end

      def rendered(journal, env: { "REQUEST_METHOD" => "GET", "PATH_INFO" => "/posts" })
        Herb::Engine::Runtime::Middleware.new(
          app {
            Herb::Engine::Runtime::Session.current.enter_render("app/views/a.html.erb", "a" * 64)
            Herb::Engine::Runtime::Session.record(diagnostic)
          },
          journal: journal
        ).call(env)
      end

      def written(dir)
        Dir.glob(File.join(dir, "journal", "**", "*.jsonl"))
      end

      test "writes nothing when it was not given one" do
        Dir.mktmpdir("herb-middleware") do |dir|
          rendered(nil)

          assert_empty written(dir)
        end
      end

      test "writes the session it opened, keyed by the text that was rendered" do
        Dir.mktmpdir("herb-middleware") do |dir|
          rendered(Herb::Engine::Runtime::Journal.new(root: dir))

          assert_path_exists File.join(dir, "journal", "app/views/a.html.erb.#{"a" * 8}.jsonl")
        end
      end

      test "takes a path and builds the journal itself" do
        Dir.mktmpdir("herb-middleware") do |dir|
          rendered(dir)

          refute_empty written(dir)
        end
      end

      test "falls back to the journal set on the class, since the host often mounts this" do
        Dir.mktmpdir("herb-middleware") do |dir|
          Herb::Engine::Runtime::Middleware.journal = dir

          rendered(nil)

          refute_empty written(dir)
        end
      end

      test "prefers the journal it was given over the one on the class" do
        Dir.mktmpdir("herb-class") do |ignored|
          Dir.mktmpdir("herb-given") do |dir|
            Herb::Engine::Runtime::Middleware.journal = ignored

            rendered(dir)

            refute_empty written(dir)
            assert_empty written(ignored)
          end
        end
      end

      test "says what request a record came from" do
        Dir.mktmpdir("herb-middleware") do |dir|
          rendered(dir)

          record = JSON.parse(File.readlines(written(dir).first).last)

          assert_equal "/posts", record["request_path"]
        end
      end

      test "applies what producers registered, so observations reach the journal" do
        Herb::Engine::Runtime::Session.measurement(:queries, origin: "Herb Engine", code: "sql-queries") do |queries|
          "#{queries.size} SQL queries"
        end

        Dir.mktmpdir("herb-middleware") do |dir|
          Herb::Engine::Runtime::Middleware.new(
            app {
              Herb::Engine::Runtime::Session.current.enter_render("app/views/a.html.erb", "a" * 64)
              Herb::Engine::Runtime::Session.at("app/views/a.html.erb", 1, 0) do
                Herb::Engine::Runtime::Session.observe(:queries, "SELECT 1")
              end
            },
            journal: dir
          ).call({})

          codes = File.readlines(written(dir).first).map { |line| JSON.parse(line)["code"] }

          assert_includes codes, "sql-queries"
        end
      end

      test "leaves a borrowed session to whoever opened it" do
        Dir.mktmpdir("herb-middleware") do |dir|
          Herb::Engine::Runtime::Session.capture { rendered(dir) }

          assert_empty written(dir)
        end
      end

      test "returns the page even when a measurement raises" do
        Herb::Engine::Runtime::Session.measurement(:queries, origin: "Herb Engine") { |_| raise "boom" }

        response = rendered(nil)

        assert_equal 200, response[0]
        assert_includes body_of(response), "Hello"
      end

      test "returns the page even when the journal cannot write" do
        response = rendered("/does/not/exist/and/cannot/be/made")

        assert_equal 200, response[0]
        assert_includes body_of(response), "Hello"
      end
    end
  end
end
