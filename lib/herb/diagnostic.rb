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

    #: (untyped, template: String, origin: String, ?severity: Symbol, ?phase: Symbol) -> Diagnostic
    def self.from(error, template:, origin:, severity: :error, phase: :compile)
      return error if error.is_a?(Diagnostic)

      if error.is_a?(Hash)
        return new(
          template: template,
          message: error[:message].to_s,
          severity: error[:severity] || severity,
          origin: error[:source] || origin,
          code: error[:code],
          location: error[:location],
          suggestion: error[:suggestion],
          phase: phase
        )
      end

      new(
        template: template,
        message: error.message,
        severity: severity,
        origin: origin,
        code: code_for(error.type),
        location: error.location,
        phase: phase,
        data: { type: error.type }
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
      { line: [position.line, 1].max, column: position.column + 1 }
    end
  end
end
