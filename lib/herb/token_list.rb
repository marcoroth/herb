# frozen_string_literal: true
# typed: false

require "delegate"

module Herb
  class TokenList < SimpleDelegator
    #: () -> String
    def inspect
      "#{items.map(&:inspect).join("\n").force_encoding("utf-8")}\n"
    end

    private

    #: () -> Array[Token]
    def items
      self #: Array[Token]
    end
  end
end
