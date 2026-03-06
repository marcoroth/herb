# frozen_string_literal: true
# typed: true

module Herb
  class LexResult < Result
    attr_reader :value #: TokenList

    #: (Array[Herb::Token], String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error]) -> void
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
