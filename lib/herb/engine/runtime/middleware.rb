# frozen_string_literal: true
# typed: true

require_relative "session"

module Herb
  class Engine
    module Runtime
      # Scopes one diagnostics session to one request and hands what it collected to the browser.
      #
      #     config.middleware.use Herb::Engine::Runtime::Middleware
      #
      # One request is the right scope because a page is what the dev tools show: findings from every
      # template that took part in it, in one payload, whoever found them.
      #
      # Nothing here is allowed to be the reason a page fails. A response it cannot safely touch is
      # returned untouched, and any error while injecting is swallowed in favour of the original
      # response.
      #
      class Middleware
        HTML_CONTENT_TYPE = %r{\Atext/html}i #: Regexp
        BODY_END_TAG = %r{</body>}i #: Regexp
        HEAD_END_TAG = %r{</head>}i #: Regexp
        ANCHORS = { head: HEAD_END_TAG, body: BODY_END_TAG }.freeze #: Hash[Symbol, Regexp]

        # Where the session for this request is left, so that anything holding the env can read what
        # the page collected.
        #
        #     get "/posts"
        #
        #     request.env[Herb::Engine::Runtime::Middleware::ENV_KEY].entries
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

        #: (untyped, Herb::Engine::Runtime::Report) -> untyped
        def inject(response, report)
          status, headers, body = response

          return response unless html?(headers)

          html = read(body)

          return response unless html

          injected = inject_channels(html, report)
          injected = inject_report(injected, report)

          return response if injected.equal?(html)

          set_content_length(headers, injected)

          [status, headers, [injected]]
        rescue StandardError
          response
        end

        #: (String, Herb::Engine::Runtime::Report) -> String
        def inject_channels(html, report)
          report.channels.reduce(html) do |carried, channel|
            tag = ANCHORS[channel.anchor]
            markup = channel.to_html

            next carried if tag.nil? || markup.empty?
            next carried unless carried.match?(tag)

            carried.sub(tag) { |matched| "#{markup}#{matched}" }
          end
        end

        #: (String, Herb::Engine::Runtime::Report) -> String
        def inject_report(html, report)
          return html unless report.reportable?
          return html unless html.match?(BODY_END_TAG)

          html.sub(BODY_END_TAG) { |tag| "#{report.to_html}#{tag}" }
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
