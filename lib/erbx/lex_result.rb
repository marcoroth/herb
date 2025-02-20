# frozen_string_literal: true

require "forwardable"

module ERBX
  class LexResult
    extend Forwardable

    def_delegators :@array, :items, :size, :capacity

    attr_accessor :array

    def initialize(pointer)
      @array = LibERBX::Array.new(pointer, LibERBX::Token)
    end

    def to_json(*_args)
      @array.items.map(&:inspect).join("\n")
    end

    def inspect
      @array.items.map(&:inspect).join("\n")
    end
  end
end
