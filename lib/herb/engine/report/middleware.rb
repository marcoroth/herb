# frozen_string_literal: true
# typed: true

require_relative "session"

module Herb
  class Engine
    class Report
      # Scopes one diagnostics session to one request and hands what it collected to the browser.
      #
      #     config.middleware.use Herb::Engine::Report::Middleware
      #
      # One request is the right scope because a page is what the dev tools show: findings from every
      # template that took part in it, in one payload, whoever found them.
      #
      # Nothing here is allowed to be the reason a page fails. A response it cannot safely touch is
      # returned untouched, and any error while injecting is swallowed in favour of the original
      # response.
      class Middleware
        HTML_CONTENT_TYPE = %r{\Atext/html}i #: Regexp
        BODY_END_TAG = %r{</body>}i #: Regexp

        # Where the session for this request is left, so that anything holding the env can read what
        # the page collected.
        #
        #     get "/posts"
        #
        #     request.env[Herb::Engine::Report::Middleware::ENV_KEY].entries
        #
        ENV_KEY = "herb.report_session" #: String

        #: (untyped, ?inject: bool) -> void
        def initialize(app, inject: true)
          @app = app
          @inject = inject
        end

        #: (untyped) -> untyped
        def call(env)
          borrowed = Session.scoped?
          session = borrowed ? Session.current : Session.open

          env[ENV_KEY] = session if env.respond_to?(:[]=)

          response = @app.call(env)

          return response unless @inject
          return response if session.empty?

          inject(response, session.report)
        ensure
          Session.close unless borrowed
        end

        private

        #: (untyped, Herb::Engine::Report) -> untyped
        def inject(response, report)
          status, headers, body = response

          return response unless html?(headers)

          html = read(body)

          return response unless html
          return response unless html.match?(BODY_END_TAG)

          html = html.sub(BODY_END_TAG) { |tag| "#{report.to_html}#{tag}" }

          set_content_length(headers, html)

          [status, headers, [html]]
        rescue StandardError
          response
        end

        #: (untyped) -> bool
        def html?(headers)
          header(headers, "content-type").to_s.match?(HTML_CONTENT_TYPE)
        end

        #: (untyped) -> String?
        def read(body)
          return nil unless body.respond_to?(:each)
          return nil if body.respond_to?(:to_path)

          buffer = +""
          body.each { |chunk| buffer << chunk }
          body.close if body.respond_to?(:close)

          buffer
        end

        #: (untyped, String) -> void
        def set_content_length(headers, html)
          name = header_name(headers, "content-length")

          headers[name] = html.bytesize.to_s if name
        end

        #: (untyped, String) -> untyped
        def header(headers, name)
          key = header_name(headers, name)

          key && headers[key]
        end

        #: (untyped, String) -> untyped
        def header_name(headers, name)
          headers.keys.find { |key| key.to_s.casecmp?(name) }
        end
      end
    end
  end
end
