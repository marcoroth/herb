# frozen_string_literal: true

require "delegate"

module Herb
  class TokenList < SimpleDelegator
    def inspect
      "#{itself.map(&:inspect).join("\n").force_encoding("utf-8")}\n"
    end
  end
end
