# frozen_string_literal: true
# typed: true

require "json"

module Herb
  class ParseResult < Result
    attr_reader :value #: Herb::AST::DocumentNode
    attr_reader :options #: Herb::ParserOptions
    attr_reader :error_count #: Integer?

    #: (Herb::AST::DocumentNode, String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error], Herb::ParserOptions, ?Integer?) -> void
    def initialize(value, source, warnings, errors, options, error_count = nil)
      @value = value
      @options = options
      @error_count = error_count
      super(source, warnings, errors)

      if options.prism_nodes || options.prism_nodes_deep
        value.source = source
      elsif options.prism_program
        # Using `instance_variable_set` doesn't propagate the source being set on the whole tree
        value.instance_variable_set(:@source, source)
      end
    end

    #: () -> Array[Herb::Errors::Error]
    def errors
      return super if error_count&.zero?

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
