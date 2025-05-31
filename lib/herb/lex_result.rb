# frozen_string_literal: true

module Herb
  class LexResult < Result
    attr_reader :value #: TokenList

    #: (value: TokenList, source: String, warnings: Array, errors: Array[Herb::Errors::Error]) -> void
    def initialize(value, source, warnings, errors)
      @value = TokenList.new(value)
      super(source, warnings, errors)
    end

    #: () -> bool
    def success?
      errors.empty?
    end

    #: () -> bool
    def failed?
      errors.any?
    end
  end
end
