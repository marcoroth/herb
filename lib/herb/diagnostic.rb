# frozen_string_literal: true
# typed: true

require_relative "location"
require_relative "position"

module Herb
  class Diagnostic
    UNKNOWN_ORIGIN = "unknown" #: String

    attr_reader :template #: String
    attr_reader :message #: String
    attr_reader :node #: String?
    attr_reader :code #: String?
    attr_reader :severity #: Symbol?
    attr_reader :kind #: Symbol
    attr_reader :origin #: String
    attr_reader :location #: Herb::Location?
    attr_reader :suggestion #: String?
    attr_reader :docs_url #: String?
    attr_reader :value #: String?
    attr_reader :phase #: Symbol
    attr_reader :data #: Hash[Symbol, untyped]
    attr_reader :error_class #: Class?

    #: (template: String, message: String, ?severity: Symbol?, ?kind: Symbol, ?origin: String, ?node: String?, ?code: String?, ?location: Herb::Location?, ?suggestion: String?, ?docs_url: String?, ?value: String?, ?phase: Symbol, ?data: Hash[Symbol, untyped], ?error_class: Class?) -> void
    def initialize(template:, message:, severity: :error, kind: :diagnostic, origin: UNKNOWN_ORIGIN, node: nil, code: nil, location: nil, suggestion: nil, docs_url: nil, value: nil, phase: :runtime, data: {}, error_class: nil)
      @template = template
      @message = message
      @node = node
      @code = code
      @severity = severity
      @kind = kind
      @origin = origin
      @location = location
      @suggestion = suggestion
      @docs_url = docs_url
      @value = value
      @phase = phase
      @data = data
      @error_class = error_class
    end

    #: (String, Hash[Symbol, untyped]) -> Diagnostic
    def self.from_compiled(template, entry)
      if entry[:line]
        location = Herb::Location.from(entry[:line], entry[:column], entry[:end_line], entry[:end_column])
      end

      new(
        template: template,
        message: entry[:message],
        severity: entry[:severity],
        code: entry[:code],
        origin: entry[:origin],
        suggestion: entry[:suggestion],
        location: location,
        phase: :compile
      )
    end

    #: (String) -> String
    def self.code_for(type)
      type
        .gsub(/([A-Z]+)([A-Z][a-z])/, '\1_\2')
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

    #: () -> bool
    def hint?
      severity == :hint
    end

    #: () -> Array[untyped]
    def key
      [template, location&.start&.line, code || message]
    end

    #: () -> Hash[Symbol, untyped]
    def to_h
      {
        template: template,
        message: message,
        node: node,
        code: code,
        severity: severity,
        kind: kind,
        origin: origin,
        location: location && serialized_location(location),
        suggestion: suggestion,
        docs_url: docs_url,
        value: value,
      }.compact
    end

    alias to_hash to_h

    #: () -> String
    def to_ruby
      parts = [
        "message: #{message.inspect}",
        "severity: #{severity.inspect}",
        "code: #{code.inspect}",
        "origin: #{origin.inspect}"
      ]

      parts << "suggestion: #{suggestion.inspect}" if suggestion

      if location
        parts << "line: #{location.start.line}" << "column: #{location.start.column}"
        parts << "end_line: #{location.end.line}" << "end_column: #{location.end.column}"
      end

      "{ #{parts.join(", ")} }"
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      require "json"

      to_h.to_json(state)
    end

    #: () -> String
    def to_s
      position = serialized_position(location.start) if location
      where = [template, position&.fetch(:line), position&.fetch(:column)].compact.join(":")

      "#{where}: [#{code || origin}] #{message}"
    end

    private

    #: (Herb::Location) -> Hash[Symbol, untyped]
    def serialized_location(location)
      { start: serialized_position(location.start), end: serialized_position(location.end) }
    end

    #: (Herb::Position) -> Hash[Symbol, Integer]
    def serialized_position(position)
      position.to_one_based
    end
  end
end
