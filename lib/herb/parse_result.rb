# frozen_string_literal: true
# typed: true

require "json"

module Herb
  class ParseResult < Result
    attr_reader :value #: Herb::AST::DocumentNode
    attr_reader :options #: Herb::ParserOptions

    #: (Herb::AST::DocumentNode, String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error], Herb::ParserOptions) -> void
    def initialize(value, source, warnings, errors, options)
      @value = value
      @options = options
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
