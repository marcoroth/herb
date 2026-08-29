# frozen_string_literal: true
# typed: true

require_relative "../diagnostic"

module Herb
  class Visitor
    # Opt-in for visitors that find something worth telling the developer about.
    #
    # A visitor records what it finds and keeps walking. The engine collects from every visitor
    # afterwards and decides what to do with the result. That split is what lets a visitor that
    # rewrites the tree also report, which a base class reserved for read-only validators could
    # never do:
    #
    #     class MyVisitor < Herb::Visitor
    #       include Herb::Visitor::ContextAware
    #       include Herb::Visitor::Diagnostics
    #
    #       def visit_html_element_node(node)
    #         warning("This element is suspicious.", node.location, code: "SuspiciousElement")
    #
    #         super
    #       end
    #     end
    #
    module Diagnostics
      include Kernel

      #: (?fatal: bool, **untyped) -> void
      def initialize(fatal: false, **)
        @fatal = fatal

        super(**)
      end

      #: () -> bool
      def fatal?
        @fatal
      end

      #: (untyped) -> void
      def self.included(base)
        super

        base.required_parser_option(track_locations: true) if base.respond_to?(:required_parser_option)
      end

      #: () -> Array[Herb::Diagnostic]
      def diagnostics
        @diagnostics ||= [] #: Array[Herb::Diagnostic]
      end

      #: (String, Herb::Location?, ?code: String?, ?suggestion: String?, ?docs_url: String?, ?error_class: Class?) -> Herb::Diagnostic
      def error(message, location, code: nil, suggestion: nil, docs_url: nil, error_class: nil)
        add_diagnostic(message, location, :error, code: code, suggestion: suggestion, docs_url: docs_url, error_class: error_class)
      end

      #: (String, Herb::Location?, ?code: String?, ?suggestion: String?, ?docs_url: String?) -> Herb::Diagnostic
      def warning(message, location, code: nil, suggestion: nil, docs_url: nil)
        add_diagnostic(message, location, :warning, code: code, suggestion: suggestion, docs_url: docs_url)
      end

      #: (String, Herb::Location?, ?code: String?, ?suggestion: String?, ?docs_url: String?) -> Herb::Diagnostic
      def info(message, location, code: nil, suggestion: nil, docs_url: nil)
        add_diagnostic(message, location, :info, code: code, suggestion: suggestion, docs_url: docs_url)
      end

      #: (String, Herb::Location?, ?code: String?, ?suggestion: String?, ?docs_url: String?) -> Herb::Diagnostic
      def hint(message, location, code: nil, suggestion: nil, docs_url: nil)
        add_diagnostic(message, location, :hint, code: code, suggestion: suggestion, docs_url: docs_url)
      end

      #: () -> Array[Herb::Diagnostic]
      def errors
        diagnostics.select(&:error?)
      end

      #: () -> Array[Herb::Diagnostic]
      def warnings
        diagnostics.select(&:warning?)
      end

      #: () -> bool
      def errors?
        diagnostics.any?(&:error?)
      end

      #: () -> bool
      def warnings?
        diagnostics.any?(&:warning?)
      end

      #: () -> void
      def clear_diagnostics
        diagnostics.clear
      end

      #: (?Symbol?) -> Integer
      def diagnostic_count(severity = nil)
        return diagnostics.length unless severity

        diagnostics.count { |diagnostic| diagnostic.severity == severity }
      end

      private

      #: (String, Herb::Location?, Symbol, ?code: String?, ?suggestion: String?, ?docs_url: String?, ?error_class: Class?) -> Herb::Diagnostic
      def add_diagnostic(message, location, severity, code: nil, suggestion: nil, docs_url: nil, error_class: nil)
        diagnostic = Herb::Diagnostic.new(
          template: diagnostic_template,
          message: message,
          severity: severity,
          origin: diagnostic_origin,
          code: code,
          location: location,
          suggestion: suggestion,
          docs_url: docs_url,
          phase: :compile,
          data: diagnostic_data,
          error_class: error_class
        )

        diagnostics << diagnostic

        diagnostic
      end

      #: () -> String
      def diagnostic_origin
        "Herb Compiler"
      end

      #: () -> Hash[Symbol, untyped]
      def diagnostic_data
        { validator: self.class.name&.split("::")&.last }
      end

      #: () -> String
      def diagnostic_template
        visitor_context = respond_to?(:context) ? send(:context) : nil

        return visitor_context.relative_file_path if visitor_context.is_a?(Context)

        Context::UNKNOWN_FILE_PATH
      end
    end
  end
end
