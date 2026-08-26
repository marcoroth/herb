# frozen_string_literal: true

require_relative "../../test_helper"

module Engine
  class ReportErrorPageTest < Minitest::Spec
    PAGE = "<html><body><h1>Hello</h1></body></html>"
    SOURCE = "<div>\n  <form>\n    <h1>Title</h1>\n</div>\n"
    HTML_ENV = { "HTTP_ACCEPT" => "text/html" }.freeze

    class Wrapper < StandardError; end

    def diagnostic
      Herb::Diagnostic.new(
        template: "app/views/posts/_post.html.erb",
        message: "Opening tag `<form>` does not have a matching closing tag.",
        code: "missing-closing-tag",
        origin: "Herb Parser",
        location: Herb::Location.from(2, 2, 2, 8),
        suggestion: "Close the `<form>` before the `</div>` on line 4."
      )
    end

    def parse_error
      Herb::Engine::ParseError.new(
        "\nHTML+ERB Compilation Errors",
        diagnostics: [diagnostic],
        source: SOURCE,
        filename: "app/views/posts/_post.html.erb"
      )
    end

    def ok_app
      ->(_env) { [200, { "content-type" => "text/html" }, [PAGE]] }
    end

    def raising_app(error)
      ->(_env) { raise error }
    end

    def wrapped_app(error)
      lambda do |_env|
        raise error
      rescue StandardError
        raise Wrapper, "ActionView::Template::Error"
      end
    end

    def middleware(app, **)
      Herb::Engine::Report::ErrorPage.new(app, **)
    end

    def payload(body)
      JSON.parse(body[%r{data-herb-diagnostics[^>]*>(.+?)</script>}m, 1].gsub("\\u003c", "<"))
    end

    describe "a request that succeeds" do
      test "passes the response through untouched" do
        status, _headers, body = middleware(ok_app).call(HTML_ENV)

        assert_equal 200, status
        assert_equal [PAGE], body
      end
    end

    describe "an error that is not Herb's" do
      test "is raised on, so nothing else is swallowed" do
        assert_raises(Wrapper) do
          middleware(raising_app(Wrapper.new("boom"))).call(HTML_ENV)
        end
      end

      test "is raised on even when it wraps something else" do
        assert_raises(Wrapper) do
          middleware(wrapped_app(ArgumentError.new("boom"))).call(HTML_ENV)
        end
      end
    end

    describe "a compilation error" do
      test "answers with a page of its own" do
        status, headers, = middleware(raising_app(parse_error)).call(HTML_ENV)

        assert_equal 500, status
        assert_equal "text/html; charset=utf-8", headers["content-type"]
        assert_equal "no-store", headers["cache-control"]
      end

      test "is found through the error Action View wraps it in" do
        status, _headers, body = middleware(wrapped_app(parse_error)).call(HTML_ENV)

        assert_equal 500, status
        assert_includes body.first, "does not have a matching closing tag"
      end

      test "sets a content length matching the body it serves" do
        _status, headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        assert_equal body.first.bytesize.to_s, headers["content-length"]
      end
    end

    describe "the payload it carries" do
      test "asks for a blocking overlay on every diagnostic" do
        _status, _headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        entries = payload(body.first)["diagnostics"]

        assert_equal 1, entries.size
        assert_equal "blocking", entries.first["overlay"]
        assert_equal "missing-closing-tag", entries.first["code"]
      end

      test "carries the template source so the panel can show an excerpt" do
        _status, _headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        assert_equal(
          { "app/views/posts/_post.html.erb" => SOURCE },
          payload(body.first)["sources"]
        )
      end

      test "makes one up for an error carrying no diagnostics" do
        error = Herb::Engine::CompilationError.new("Something went wrong.")

        _status, _headers, body = middleware(raising_app(error)).call(HTML_ENV)

        entry = payload(body.first)["diagnostics"].first

        assert_equal "Something went wrong.", entry["message"]
        assert_equal "blocking", entry["overlay"]
        assert_equal "Herb Compiler", entry["origin"]
      end
    end

    describe "the page it serves" do
      test "says what is wrong without any JavaScript" do
        _status, _headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        assert_includes body.first, "This template could not be compiled"
        assert_includes body.first, "app/views/posts/_post.html.erb:2:3"
        assert_includes body.first, "Close the `&lt;form&gt;` before"
      end

      test "escapes the source it prints" do
        _status, _headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        assert_includes body.first, "&lt;form&gt;"
        refute_includes body.first[%r{<pre>.+?</pre>}m], "<form>"
      end

      test "scopes every style rule to itself" do
        _status, _headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        css = body.first[%r{<style>(.+?)</style>}m, 1]
        selectors = css.gsub(/\{[^}]*\}/m, "\n").split("\n").map(&:strip).reject(&:empty?)

        stray = selectors.reject { |selector| selector == "body" || selector.start_with?(".herb-error") }

        assert_empty stray, "every rule but `body` has to be scoped to .herb-error"
      end

      test "shows a section for every diagnostic, not just the first" do
        error = Herb::Engine::ParseError.new(
          "\nHTML+ERB Compilation Errors",
          diagnostics: [
            diagnostic,
            Herb::Diagnostic.new(
              template: "app/views/posts/_post.html.erb",
              message: "Found closing tag `</span>` without a matching opening tag.",
              code: "missing-opening-tag",
              origin: "Herb Parser",
              location: Herb::Location.from(5, 0, 5, 7)
            )
          ],
          source: SOURCE,
          filename: "app/views/posts/_post.html.erb"
        )

        _status, _headers, body = middleware(raising_app(error)).call(HTML_ENV)

        assert_equal 2, body.first.scan("<section>").size
        assert_equal 2, payload(body.first)["diagnostics"].size
        assert_includes body.first, "without a matching opening tag"
      end

      test "starts the dev tools when it is told where they are" do
        _status, _headers, body = middleware(raising_app(parse_error), dev_tools: "/assets/herb.js").call(HTML_ENV)

        assert_includes body.first, %(import { HerbDevTools } from "/assets/herb.js")
        assert_includes body.first, "HerbDevTools.start("
      end

      test "reloads itself once the dev server says the file compiles again" do
        _status, _headers, body = middleware(raising_app(parse_error), dev_tools: "/assets/herb.js").call(HTML_ENV)

        assert_includes body.first, "onFixed: () => window.location.reload()"
        refute_includes body.first, "devServer: false"
      end

      test "leaves the script out when it is not" do
        _status, _headers, body = middleware(raising_app(parse_error)).call(HTML_ENV)

        refute_includes body.first, "HerbDevTools"
      end
    end

    describe "when it should stay out of the way" do
      test "raises on while disabled" do
        assert_raises(Herb::Engine::ParseError) do
          middleware(raising_app(parse_error), enabled: false).call(HTML_ENV)
        end
      end

      test "raises on for a request that did not ask for HTML" do
        assert_raises(Herb::Engine::ParseError) do
          middleware(raising_app(parse_error)).call({ "HTTP_ACCEPT" => "application/json" })
        end
      end

      test "answers a request that asked for nothing in particular" do
        status, = middleware(raising_app(parse_error)).call({})

        assert_equal 500, status
      end
    end

    describe "a cause chain that loops" do
      test "gives up rather than walking it forever" do
        outer = Wrapper.new("outer")

        outer.define_singleton_method(:cause) { outer }

        assert_raises(Wrapper) do
          middleware(raising_app(outer)).call(HTML_ENV)
        end
      end
    end
  end
end
