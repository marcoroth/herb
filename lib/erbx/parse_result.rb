# frozen_string_literal: true

require "json"

module ERBX
  class ParseResult < Result
    attr_reader :value

    def initialize(value, source, warnings, errors)
      @value = value
      super(source, warnings, errors)
    end

    def failed?
      errors.any? || value.errors.any? # TODO: this should probably be recursive
    end

    def success?
      !failed?
    end

    def pretty_errors
      JSON.pretty_generate(errors + value.errors)
    end
  end
end
