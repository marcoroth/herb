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
    attr_reader :overlay #: Symbol?
    attr_reader :phase #: Symbol
    attr_reader :data #: Hash[Symbol, untyped]
    attr_reader :error_class #: Class?

    #: (template: String, message: String, ?severity: Symbol?, ?kind: Symbol, ?origin: String, ?node: String?, ?code: String?, ?location: Herb::Location?, ?suggestion: String?, ?docs_url: String?, ?value: String?, ?overlay: Symbol?, ?phase: Symbol, ?data: Hash[Symbol, untyped], ?error_class: Class?) -> void
    def initialize(template:, message:, severity: :error, kind: :diagnostic, origin: UNKNOWN_ORIGIN, node: nil, code: nil, location: nil, suggestion: nil, docs_url: nil, value: nil, overlay: nil, phase: :runtime, data: {}, error_class: nil)
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
      @overlay = overlay
      @phase = phase
      @data = data
      @error_class = error_class
    end

    #: (Array[Herb::Errors::Error], template: String, ?origin: String) -> Array[Diagnostic]
    def self.from_errors(errors, template:, origin: "Herb Parser")
      errors.map { |error| error.to_diagnostic(template: template, origin: origin) }
    end

    #: (String, Hash[Symbol, untyped]) -> Diagnostic
    def self.from_compiled(template, entry)
      if entry[:line]
        location = Herb::Location.from(entry[:line], entry[:column], entry[:end_line], entry[:end_column])
      end

      new(
        template: entry[:template] || template,
        message: entry[:message],
        severity: entry[:severity],
        code: entry[:code],
        origin: entry[:origin],
        suggestion: entry[:suggestion],
        location: location,
        phase: :compile
      )
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

    #: (String?) -> Diagnostic
    def with_node(node)
      return self if node.nil? || @node

      dup.tap { |copy| copy.instance_variable_set(:@node, node) }
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
        overlay: overlay,
        phase: phase,
      }.compact
    end

    alias to_hash to_h

    def to_ruby(compiled = nil)
      parts = [
        "message: #{message.inspect}",
        "severity: #{severity.inspect}",
        "code: #{code.inspect}",
        "origin: #{origin.inspect}"
      ]

      parts << "suggestion: #{suggestion.inspect}" if suggestion
      parts << "template: #{template.inspect}" if template && template != compiled

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
