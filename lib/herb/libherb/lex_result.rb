# frozen_string_literal: true
# typed: ignore
# rbs_inline: disabled

require "forwardable"

module Herb
  class LexResult
    extend Forwardable

    def_delegators :@array, :items, :size, :capacity

    attr_accessor :array

    def initialize(pointer)
      @array = LibHerb::Array.new(pointer, LibHerb::Token)
    end

    def as_json
      JSON.parse(to_json)
    end

    def to_json(*_args)
      "[#{@array.items.map(&:to_json).join(", ")}]"
    end

    def inspect
      @array.items.map(&:inspect).join("\n")
    end
  end
end
