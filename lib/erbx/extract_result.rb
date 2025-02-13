# frozen_string_literal: true

require "forwardable"

module ERBX
  class ExtractResult
    extend Forwardable

    def_delegators :@buffer, :read

    attr_accessor :buffer

    def initialize(pointer)
      @buffer = LibERBX::Buffer.new(pointer)
    end
  end
end
