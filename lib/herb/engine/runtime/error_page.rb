# frozen_string_literal: true
# typed: true

require "json"

require_relative "../../diagnostic"
require_relative "../../version"
require_relative "../errors"
require_relative "report"

module Herb
  class Engine
    module Runtime
      # Serves a page the dev tools can boot into when a template refused to compile.
      #
      #     config.middleware.use Herb::Engine::Runtime::ErrorPage, dev_tools: "/assets/herb-dev-tools.js"
      #
      # A template that fails to compile takes the whole response with it, so there is no page left
      # for `Middleware` to inject into and nothing for the dev tools to attach to. This serves a
      # document of its own carrying the same diagnostics payload, which the panel reads on start and
      # shows as a blocking overlay.
      #
      # Action View wraps the failure in its own error, so what arrives here is an
      # `ActionView::Template::Error` whose `cause` is the Herb one. The chain is walked rather than
      # rescued by class for that reason.
      #
      # The page says what is wrong without any JavaScript at all. The dev tools are an enhancement
      # on top of that, so a missing or misconfigured bundle costs the overlay and not the message.
      #
      class ErrorPage
        HTML_REQUEST = %r{text/html|application/xhtml}i #: Regexp
        MAX_CAUSES = 16 #: Integer
        CONTEXT_LINES = 3 #: Integer
        ORIGIN = "Herb Compiler" #: String
        UNKNOWN_TEMPLATE = "(unknown template)" #: String

        STYLES = <<~CSS #: String
          body { margin: 0; background: #f3f4f6; color: #111827; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
          .herb-error { max-width: 1040px; margin: 0 auto; padding: 40px 28px; }
          .herb-error h1 { margin: 0 0 24px; font-size: 20px; }
          .herb-error section { margin-bottom: 24px; padding: 20px; border-radius: 10px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
          .herb-error p { margin: 0 0 8px; }
          .herb-error .herb-where { color: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
          .herb-error .herb-hint { color: #065f46; }
          .herb-error pre { overflow-x: auto; margin: 12px 0 0; padding: 14px; border-radius: 8px; background: #282c34; color: #abb2bf; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
          .herb-error pre span { display: block; }
          .herb-error .herb-marked { color: #e06c75; }
          .herb-error .herb-error-provenance { margin-top: 32px; color: #6b7280; font-size: 13px; }
          .herb-error .herb-error-provenance ul { margin: 6px 0 0; padding-left: 20px; }
          .herb-error .herb-error-provenance code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        CSS

        #: (untyped, ?dev_tools: (String | ^() -> String?)?, ?dev_server_port: (Integer | String | ^() -> untyped)?, ?enabled: bool) -> void
        def initialize(app, dev_tools: nil, dev_server_port: nil, enabled: true)
          @app = app
          @dev_tools = dev_tools
          @dev_server_port = dev_server_port
          @enabled = enabled
        end

        #: (untyped) -> untyped
        def call(env)
          @app.call(env)
        rescue StandardError => e
          error = @enabled ? compilation_error(e) : nil

          raise e unless error
          raise e unless wants_html?(env)

          respond(error)
        end

        private

        #: (Exception) -> Herb::Engine::CompilationError?
        def compilation_error(error)
          seen = [] #: Array[Exception]
          current = error #: Exception?

          while current && seen.size < MAX_CAUSES && !seen.include?(current)
            return current if current.is_a?(Herb::Engine::CompilationError)

            seen << current
            current = current.cause
          end

          nil
        end

        #: (untyped) -> bool
        def wants_html?(env)
          accept = env["HTTP_ACCEPT"].to_s

          return true if accept.empty?

          accept.match?(HTML_REQUEST)
        end

        #: (Herb::Engine::CompilationError) -> untyped
        def respond(error)
          body = page(error)

          headers = {
            "content-type" => "text/html; charset=utf-8",
            "content-length" => body.bytesize.to_s,
            "cache-control" => "no-store",
          }

          [500, headers, [body]]
        end

        #: (Herb::Engine::CompilationError) -> Herb::Engine::Runtime::Report
        def report_for(error)
          report = Report.new

          diagnostics_for(error).each { |diagnostic| report.add(diagnostic) }

          note_source(report, error)
          note_provenance(report, error)

          report
        end

        #: (Herb::Engine::Runtime::Report, Herb::Engine::CompilationError) -> void
        def note_source(report, error)
          template = template_for(error)

          return unless template
          return report.source(template, error.source) if error.is_a?(Herb::Engine::ParseError)

          details = error.details

          report.source(template, details.source) if details.is_a?(Herb::Diagnostic::Formatter)
        end

        #: (Herb::Engine::Runtime::Report, Herb::Engine::CompilationError) -> void
        def note_provenance(report, error)
          report.note(:herb_version, Herb::VERSION)
          report.note(:error_class, error.class.name)

          report.note(:visitors, error.visitors) unless error.visitors.empty?
          report.note(:parser_options, error.parser_options) unless error.parser_options.empty?
        end

        #: (Herb::Engine::CompilationError) -> Array[Herb::Diagnostic]
        def diagnostics_for(error)
          return error.diagnostics.map { |diagnostic| blocking(diagnostic) } unless error.diagnostics.empty?

          [
            Herb::Diagnostic.new(
              template: template_for(error) || UNKNOWN_TEMPLATE,
              message: error.message.to_s.strip,
              severity: :error,
              origin: ORIGIN,
              phase: :compile,
              overlay: :blocking
            )
          ]
        end

        #: (Herb::Diagnostic) -> Herb::Diagnostic
        def blocking(diagnostic)
          Herb::Diagnostic.new(
            template: diagnostic.template,
            message: diagnostic.message,
            severity: diagnostic.severity,
            kind: diagnostic.kind,
            origin: diagnostic.origin,
            node: diagnostic.node,
            code: diagnostic.code,
            location: diagnostic.location,
            suggestion: diagnostic.suggestion,
            docs_url: diagnostic.docs_url,
            value: diagnostic.value,
            overlay: :blocking,
            phase: :compile
          )
        end

        #: (Herb::Engine::CompilationError) -> String?
        def template_for(error)
          return error.filename if error.is_a?(Herb::Engine::ParseError)

          template = error.diagnostics.first&.template

          return template if template

          details = error.details

          details.filename.to_s if details.is_a?(Herb::Diagnostic::Formatter)
        end

        #: (Herb::Engine::CompilationError) -> String
        def page(error)
          report = report_for(error)
          diagnostics = report.diagnostics

          [
            "<!DOCTYPE html>",
            %(<html lang="en"><head><meta charset="utf-8">),
            %(<meta name="viewport" content="width=device-width, initial-scale=1">),
            %(<meta name="herb-debug-mode" content="true">),
            dev_server_port_meta_tag,
            "<title>#{escape(title(diagnostics))}</title>",
            "<style>#{STYLES}</style>",
            "</head><body>",
            fallback(diagnostics, report.sources, provenance(report.meta)),
            report.to_html,
            script_tag,
            "</body></html>"
          ].join
        end

        #: (Array[Herb::Diagnostic]) -> String
        def title(diagnostics)
          first = diagnostics.first

          return "Herb" unless first

          [first.template, "could not be compiled"].join(" ")
        end

        #: () -> String
        def script_tag
          path = dev_tools_path

          return "" unless path

          <<~HTML
            <script type="module">
              import { HerbDevTools } from #{JSON.generate(path)}

              document.addEventListener("herb:dev-server-fixed", () => window.location.reload())

              HerbDevTools.start({
                devServer: { onFixed: () => window.location.reload() }
              })
            </script>
          HTML
        end

        #: () -> String?
        def dev_tools_path
          path = resolved(@dev_tools)

          path.is_a?(String) && !path.empty? ? path : nil
        end

        #: () -> String
        def dev_server_port_meta_tag
          port = resolved(@dev_server_port).to_s

          return "" if port.empty?

          %(<meta name="herb-dev-server-port" content="#{escape(port)}">)
        end

        #: (untyped) -> untyped
        def resolved(value)
          value.respond_to?(:call) ? value.call : value
        rescue StandardError
          nil
        end

        #: (Hash[Symbol, untyped]) -> String
        def provenance(meta)
          return "" if meta.empty?

          version = meta[:herb_version]
          visitors = Array(meta[:visitors]) #: Array[untyped]
          options = meta[:parser_options].is_a?(Hash) ? meta[:parser_options] : {} #: Hash[untyped, untyped]

          rows = [] #: Array[String]

          rows << %(<p>Compiled by Herb::Engine #{escape(version.to_s)}.</p>) if version

          unless options.empty?
            pairs = options.map { |key, value| %(<li><code>#{escape(key.to_s)}: #{escape(value.inspect)}</code></li>) }

            rows << %(<p>Parser options it was given:</p><ul>#{pairs.join}</ul>)
          end

          unless visitors.empty?
            names = visitors.map { |visitor| %(<li><code>#{escape(visitor.to_s)}</code></li>) }

            rows << %(<p>Visitors on the stack when it failed:</p><ul>#{names.join}</ul>)
          end

          return "" if rows.empty?

          %(<footer class="herb-error-provenance">#{rows.join}</footer>)
        end

        #: (Array[Herb::Diagnostic], Hash[String, String], String) -> String
        def fallback(diagnostics, sources, provenance)
          sections = diagnostics.map { |diagnostic| section(diagnostic, sources[diagnostic.template]) }

          %(<main class="herb-error"><h1>This template could not be compiled</h1>#{sections.join}#{provenance}</main>)
        end

        #: (Herb::Diagnostic, String?) -> String
        def section(diagnostic, source)
          start = diagnostic.location&.start
          where = [diagnostic.template, start&.line, start && (start.column + 1)].compact.join(":")

          [
            "<section>",
            %(<p class="herb-where">#{escape(where)}</p>),
            "<p>#{escape(diagnostic.message)}</p>",
            diagnostic.suggestion ? %(<p class="herb-hint">#{escape(diagnostic.suggestion)}</p>) : "",
            excerpt(source, start&.line),
            "</section>"
          ].join
        end

        #: (String?, Integer?) -> String
        def excerpt(source, line)
          return "" unless source && line

          lines = source.lines
          first = [line - CONTEXT_LINES, 1].max
          last = [line + CONTEXT_LINES, lines.length].min

          rows = (first..last).map { |number|
            marker = number == line ? "&gt;" : "&nbsp;"
            text = escape(lines[number - 1].to_s.chomp)

            %(<span class="#{"herb-marked" if number == line}">#{marker} #{number.to_s.rjust(4)}  #{text}</span>)
          }

          "<pre>#{rows.join}</pre>"
        end

        #: (String) -> String
        def escape(value)
          value.to_s.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;")
        end

        #: (String) -> String
        def escape_attribute(value)
          escape(value).gsub('"', "&quot;")
        end
      end
    end
  end
end
