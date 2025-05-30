# frozen_string_literal: true
# typed: false

require "delegate"

module Herb
  class TokenList < SimpleDelegator
    #: () -> String
    def inspect
      "#{itself.map(&:inspect).join("\n").force_encoding("utf-8")}\n"
    end
  end
end
