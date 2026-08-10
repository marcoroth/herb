# frozen_string_literal: true

require_relative "../../herb"

module Herb
  class Engine
    # One finding about a template, whoever found it and whenever they found it.
    #
    # A validator finds things while the template compiles, an accessibility check or a collector
    # finds them while it renders, and the parser finds them before either. They all describe the
    # same thing: a severity, a position in a template, and something to say about it. Keeping one
    # shape means one wire format and one reader in the dev tools, rather than one per producer.
    class Diagnostic
      SEVERITIES = [:error, :warning, :info].freeze

      attr_reader :severity #: Symbol
      attr_reader :source #: String
      attr_reader :code #: String
      attr_reader :message #: String
      attr_reader :filename #: String?
      attr_reader :line #: Integer?
      attr_reader :column #: Integer?
      attr_reader :suggestion #: String?
      attr_reader :documentation_url #: String?
      attr_reader :data #: Hash[Symbol, untyped]
      attr_reader :phase #: Symbol

      #: (severity: Symbol, source: String, code: String, message: String, ?filename: String?, ?line: Integer?, ?column: Integer?, ?suggestion: String?, ?documentation_url: String?, ?phase: Symbol, ?data: Hash[Symbol, untyped]) -> void
      def initialize(severity:, source:, code:, message:, filename: nil, line: nil, column: nil, suggestion: nil, documentation_url: nil, phase: :runtime, data: {})
        @severity = severity
        @source = source
        @code = code
        @message = message
        @filename = filename
        @line = line
        @column = column
        @suggestion = suggestion
        @documentation_url = documentation_url
        @phase = phase
        @data = data
      end

      #: (Herb::Errors::Error, source: String, ?filename: String?, ?severity: Symbol, ?phase: Symbol, ?suggestion: String?, ?documentation_url: String?) -> Diagnostic
      def self.from_error(error, source:, filename: nil, severity: :error, phase: :compile, suggestion: nil,
                          documentation_url: nil)
        location = error.location
        code = code_for(error.type)

        new(
          severity: severity,
          source: source,
          code: code,
          message: error.message,
          filename: filename,
          line: location&.start&.line,
          column: location&.start&.column,
          suggestion: suggestion,
          documentation_url: documentation_url || documentation_url_for(code),
          phase: phase,
          data: error.to_hash.except(:type, :location, :message)
        )
      end

      #: (String) -> String
      def self.code_for(type)
        type
          .gsub(/([A-Z])(?=[A-Z][a-z])/, '\1_')
          .gsub(/([a-z\d])([A-Z])/, '\1_\2')
          .downcase
          .sub(/_?error\z/, "")
          .tr("_", "-")
      end

      #: () -> bool
      def error?
        severity == :error
      end

      #: () -> bool
      def warning?
        severity == :warning
      end

      #: () -> bool
      def info?
        severity == :info
      end

      #: () -> Hash[Symbol, untyped]
      def to_h
        {
          severity: severity,
          source: source,
          code: code,
          message: message,
          filename: filename,
          line: line,
          column: column,
          suggestion: suggestion,
          documentation_url: documentation_url,
          phase: phase,
          data: data,
        }.compact
      end

      #: (?untyped) -> String
      def to_json(state = nil)
        require "json"

        to_h.to_json(state)
      end

      #: () -> String
      def to_s
        position = [filename, line, column].compact.join(":")

        "#{severity}: #{message} (#{source}#{" at #{position}" unless position.empty?})"
      end
    end
  end
end
