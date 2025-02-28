# frozen_string_literal: true

module ERBX
  class ParseResult < Result
    attr_reader :value

    def initialize(value, source, warnings, errors)
      @value = value
      super(source, warnings, errors)
    end
  end
end
