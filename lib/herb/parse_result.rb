# frozen_string_literal: true

require "json"

module Herb
  class ParseResult < Result
    attr_reader :value #: Herb::AST::DocumentNode

    #: (Herb::AST::DocumentNode, String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error]) -> void
    def initialize(value, source, warnings, errors)
      @value = value
      super(source, warnings, errors)
    end

    #: () -> Array[Herb::Errors::Error]
    def errors
      super + value.recursive_errors
    end

    #: () -> bool
    def failed?
      errors.any?
    end

    #: () -> bool
    def success?
      !failed?
    end

    #: () -> String
    def pretty_errors
      JSON.pretty_generate(errors)
    end

    #: () -> String
    def to_source(...)
      value.to_source(...)
    end

    #: (Visitor) -> void
    def visit(visitor)
      value.accept(visitor)
    end

    #: (Hash[untyped, untyped]) -> ParseResult
    def self.from_hash(data)
      value_date = data[:value] || data["value"]
      warnings_data = data[:warnings] || data["warnings"] || [] #: Array[untyped]
      errors_data = data[:errors] || data["errors"] || [] #: Array[untyped]
      source = data[:source] || data["source"] || ""

      value = value_date ? Herb::AST::Node.node_from_hash(value_date) : nil
      raise "Missing document node" unless value.is_a?(Herb::AST::DocumentNode)

      warnings = warnings_data.map { |warning_data| Herb::Warnings::Warning.from_hash(warning_data) }
      errors = errors_data.map { |error_data| Herb::Errors::Error.from_hash(error_data) }

      new(value, source, warnings, errors)
    end
  end
end
