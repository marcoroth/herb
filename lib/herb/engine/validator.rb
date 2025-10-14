# frozen_string_literal: true

module Herb
  class Engine
    class Validator < Herb::Visitor
      attr_reader :diagnostics

      def initialize
        super

        @diagnostics = []
      end

      def validate(node)
        visit(node)
      end

      def error(message, location, code: nil, source: nil)
        add_diagnostic(message, location, :error, code: code, source: source)
      end

      def warning(message, location, code: nil, source: nil)
        add_diagnostic(message, location, :warning, code: code, source: source)
      end

      def info(message, location, code: nil, source: nil)
        add_diagnostic(message, location, :info, code: code, source: source)
      end

      def hint(message, location, code: nil, source: nil)
        add_diagnostic(message, location, :hint, code: code, source: source)
      end

      def errors?
        @diagnostics.any? { |diagnostic| diagnostic[:severity] == :error }
      end

      def warnings?
        @diagnostics.any? { |diagnostic| diagnostic[:severity] == :warning }
      end

      def errors
        @diagnostics.select { |diagnostic| diagnostic[:severity] == :error }
      end

      def warnings
        @diagnostics.select { |diagnostic| diagnostic[:severity] == :warning }
      end

      def clear_diagnostics
        @diagnostics.clear
      end

      def diagnostic_count(severity = nil)
        return @diagnostics.length unless severity

        @diagnostics.count { |diagnostic| diagnostic[:severity] == severity }
      end

      private

      def add_diagnostic(message, location, severity, code: nil, source: nil)
        diagnostic = {
          message: message,
          location: location,
          severity: severity,
          code: code,
          source: source || self.class.name,
        }

        @diagnostics << diagnostic
      end
    end
  end
end
