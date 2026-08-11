# frozen_string_literal: true

require_relative "../../test_helper"

module Engine
  class ReportMiddlewareTest < Minitest::Spec
    PAGE = "<html><body><h1>Hello</h1></body></html>"

    before do
      Herb::Engine::Report::Session.reset!
    end

    after do
      Herb::Engine::Report::Session.reset!
    end

    def diagnostic(message: "Something is wrong.")
      Herb::Diagnostic.new(
        template: "app/views/a.html.erb",
        message: message,
        code: "invalid-nesting",
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
      Herb::Engine::Report::Middleware.new(app, inject: inject).call({})
    end

    def body_of(response)
      buffer = +""

      response[2].each { |chunk| buffer << chunk }

      buffer
    end

    test "injects the payload before the closing body tag" do
      response = call(app { Herb::Engine::Report::Session.record(diagnostic) })
      body = body_of(response)

      assert_includes body, 'data-herb-diagnostics data-count="1"'
      assert_match(%r{#{Regexp.escape(%(</script>))}</body>}, body)
    end

    test "leaves a response alone when nothing was found" do
      response = call(app)

      assert_equal PAGE, body_of(response)
    end

    test "leaves a response alone when injection is off" do
      response = call(app { Herb::Engine::Report::Session.record(diagnostic) }, inject: false)

      assert_equal PAGE, body_of(response)
    end

    test "leaves a response that is not HTML alone" do
      json = app(body: %({"ok":true}), headers: { "content-type" => "application/json" }) do
        Herb::Engine::Report::Session.record(diagnostic)
      end

      assert_equal %({"ok":true}), body_of(call(json))
    end

    test "leaves HTML without a closing body tag alone" do
      fragment = app(body: "<div>partial</div>") { Herb::Engine::Report::Session.record(diagnostic) }

      assert_equal "<div>partial</div>", body_of(call(fragment))
    end

    test "finds the content type whatever case the header is in" do
      response = call(
        app(headers: { "Content-Type" => "text/html" }) do
          Herb::Engine::Report::Session.record(diagnostic)
        end
      )

      assert_includes body_of(response), "data-herb-diagnostics"
    end

    test "corrects the content length it just changed" do
      headers = { "content-type" => "text/html", "content-length" => PAGE.bytesize.to_s }
      response = call(app(headers: headers) { Herb::Engine::Report::Session.record(diagnostic) })

      assert_equal body_of(response).bytesize.to_s, response[1]["content-length"]
    end

    test "leaves a file-backed response alone rather than buffering it" do
      streamed = Object.new

      def streamed.each(&block)
        block.call("<html><body></body></html>")
      end

      def streamed.to_path
        "/tmp/some-file.html"
      end

      response = call(
        lambda { |_env|
          Herb::Engine::Report::Session.record(diagnostic)

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
          Herb::Engine::Report::Session.record(diagnostic)

          [200, { "content-type" => "text/html" }, broken]
        }
      )

      assert_same broken, response[2]
    end

    test "closes the session, so one request's findings do not reach the next" do
      call(app { Herb::Engine::Report::Session.record(diagnostic) })

      assert_empty Herb::Engine::Report::Session.current.diagnostics
    end

    test "keeps each request's findings to itself" do
      first = call(app { Herb::Engine::Report::Session.record(diagnostic(message: "first")) })
      second = call(app { Herb::Engine::Report::Session.record(diagnostic(message: "second")) })

      assert_includes body_of(first), "first"
      refute_includes body_of(second), "first"
    end
  end
end
