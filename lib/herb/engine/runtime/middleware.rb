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
      # Given a journal, the same session is also written to disk, where it outlives the page and an
      # editor can read it. Whoever mounts this middleware is often not the application, so the
      # journal can be set on the class instead of passed:
      #
      #     Herb::Engine::Runtime::Middleware.journal = "tmp/herb"
      #
      # Nothing here is allowed to be the reason a page fails. A response it cannot safely touch is
      # returned untouched, and any error while injecting, measuring or writing is swallowed in
      # favour of the original response.
      #
      class Middleware
        # Where a session goes when whoever mounted this middleware did not say. Left unset, nothing
        # is written.
        #
        # Written out instead of as an `attr_accessor` in a `class << self` block, because rbs-inline
        # emits that as an instance accessor and the signature would be wrong.
        #: () -> untyped
        def self.journal # rubocop:disable Style/TrivialAccessors
          @journal
        end

        #: (untyped) -> void
        def self.journal=(journal) # rubocop:disable Style/TrivialAccessors
          @journal = journal
        end

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

        #: (untyped, ?inject: bool, ?journal: untyped) -> void
        def initialize(app, inject: true, journal: nil)
          @app = app
          @inject = inject
          @journal = journal
        end

        #: (untyped) -> untyped
        def call(env)
          borrowed = Session.scoped?
          session = borrowed ? Session.current : Session.open

          env[ENV_KEY] = session if env.respond_to?(:[]=)

          response = @app.call(env)

          unless borrowed
            measure(session)
            persist(session, env, response)
          end

          return response unless @inject
          return response if session.empty?

          inject(response, session.report)
        ensure
          Session.close unless borrowed
        end

        private

        #: (Herb::Engine::Runtime::Session) -> void
        def measure(session)
          session.apply_measurements

          nil
        rescue StandardError
          nil
        end

        #: (Herb::Engine::Runtime::Session, untyped, untyped) -> void
        def persist(session, env, response)
          journal = coerce(@journal || self.class.journal)

          return unless journal
          return if session.empty?

          journal.write(session.report, request: request_of(env, response))

          nil
        rescue StandardError
          nil
        end

        #: (untyped, untyped) -> Hash[Symbol, untyped]
        def request_of(env, response)
          {
            method: env["REQUEST_METHOD"],
            path: env["PATH_INFO"],
            status: response.is_a?(Array) ? response[0] : nil,
          }.compact
        end

        #: (untyped) -> untyped
        def coerce(journal)
          return nil unless journal

          require_relative "journal"

          return journal if journal.is_a?(Journal)
          return Journal.new if journal == true

          Journal.new(root: journal)
        end

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
