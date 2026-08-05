# frozen_string_literal: true
# typed: false

require "json"

module Herb
  class Engine
    module AccessibilityAudit
      # Rack middleware that scopes one audit session to one request, which is what the
      # `duplicate-id` check needs to see a whole document and what `sample_rate` samples over.
      #
      # TODO: Lint the rendered response here once the linter is callable from Ruby.
      #
      # By the time a response leaves this middleware it is pure static HTML, so the entire linter
      # ruleset applies to it with no dynamic-value bailouts, including the rules that per-value
      # instrumentation structurally cannot reach because they need the assembled document:
      # `label[for]` pointing at an id that exists, `aria-labelledby` targets, nesting that only
      # materializes once conditionals and partials resolve, and duplicate ids without any session
      # bookkeeping.
      #
      # The hard part is provenance: an offense on the rendered page points at a line of response
      # body, not at a template. `DebugVisitor` already annotates elements with
      # `data-herb-debug-file-relative-path` / `-line` / `-column`, so offenses could be mapped back
      # to the nearest annotated ancestor. That needs a variant of the debug attributes that does not
      # insert `<span style="display: contents">` wrappers around ERB output, since those wrappers
      # would themselves trip nesting rules (a `<span>` between `<ul>` and `<li>`, for instance).
      #
      # This does not replace the compiled instrumentation: page-level linting reports after the
      # response is built and needs a whole document, while the instrumentation gives exact template
      # positions, works on fragments and mailers, and is cheap enough to sample in production.
      class Middleware
        HTML_CONTENT_TYPE = %r{\Atext/html}i
        BODY_END_TAG = %r{</body>}i

        #: (untyped, ?inject: bool) -> void
        def initialize(app, inject: true)
          @app = app
          @inject = inject
        end

        #: (Hash[String, untyped]) -> untyped
        def call(env)
          return @app.call(env) if AccessibilityAudit.mode == :disabled

          response = nil #: untyped
          violations = AccessibilityAudit.collect { response = @app.call(env) }

          return response unless @inject
          return response if violations.empty?

          inject_violations(response, violations)
        end

        private

        #: (untyped, Array[Violation]) -> untyped
        def inject_violations(response, violations)
          status, headers, body = response

          return response unless html_response?(headers)

          html = read_body(body)

          return response unless html&.match?(BODY_END_TAG)

          html = html.sub(BODY_END_TAG) { |tag| "#{markup(violations)}#{tag}" }

          set_content_length(headers, html)

          [status, headers, [html]]
        rescue StandardError
          response
        end

        #: (Array[Violation]) -> String
        def markup(violations)
          payload = violations.map(&:to_h).to_json.gsub("<", "\\u003c")
          attributes = %(type="application/json" data-herb-accessibility-violations data-count="#{violations.length}")

          "<script #{attributes}>#{payload}</script>"
        end

        #: (Hash[String, untyped]) -> bool
        def html_response?(headers)
          content_type = header(headers, "content-type")

          !content_type.nil? && content_type.match?(HTML_CONTENT_TYPE)
        end

        # Only touches a body that is safe to buffer, which leaves streaming responses alone.
        #: (untyped) -> String?
        def read_body(body)
          return nil unless body.respond_to?(:each)
          return nil if body.respond_to?(:to_path)

          html = +""
          body.each { |part| html << part.to_s }
          body.close if body.respond_to?(:close)

          html
        end

        #: (Hash[String, untyped], String) -> void
        def set_content_length(headers, html)
          key = headers.keys.find { |name| name.to_s.casecmp?("content-length") }

          headers[key] = html.bytesize.to_s if key

          nil
        end

        #: (Hash[String, untyped], String) -> String?
        def header(headers, name)
          key = headers.keys.find { |candidate| candidate.to_s.casecmp?(name) }

          key ? headers[key].to_s : nil
        end
      end
    end
  end
end
