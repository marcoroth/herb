# frozen_string_literal: true

require "json"

module Herb
  class ParseResult < Result
    attr_reader :value #: Herb::AST::DocumentNode
    attr_reader :strict #: bool
    attr_reader :track_whitespace #: bool
    attr_reader :analyze #: bool

    #: (Herb::AST::DocumentNode, String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error], ?Hash[Symbol, untyped]) -> void
    def initialize(value, source, warnings, errors, options = {})
      @value = value
      @strict = options.fetch(:strict, true)
      @track_whitespace = options.fetch(:track_whitespace, false)
      @analyze = options.fetch(:analyze, true)
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

    #: (Visitor) -> void
    def visit(visitor)
      value.accept(visitor)
    end
  end
end
