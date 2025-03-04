# frozen_string_literal: true

module ERBX
  class LexResult < Result
    attr_reader :value

    def initialize(value, source, warnings, errors)
      @value = TokenList.new(value)
      super(source, warnings, errors)
    end

    def success?
      errors.empty?
    end

    def failed?
      errors.any?
    end
  end
end
