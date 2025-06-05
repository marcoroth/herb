# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

require "forwardable"

module Herb
  module LibHerb
    attach_function :array_get, [:pointer, :int], :pointer
    attach_function :array_capacity, [:pointer], :size_t
    attach_function :array_size, [:pointer], :size_t

    class Array
      extend Forwardable

      attr_reader :pointer, :item_class

      def_delegators :items, :first, :last, :[]

      def initialize(pointer, item_class)
        @pointer = pointer
        @item_class = item_class
      end

      def capacity
        LibHerb.array_capacity(pointer)
      end

      def size
        LibHerb.array_size(pointer)
      end

      def item_pointers
        size.times.map { |item|
          LibHerb.array_get(pointer, item)
        }
      end

      def items
        item_pointers.map { |item_pointer|
          item_class.new(item_pointer)
        }
      end

      def inspect
        %(#<#{self.class} size=#{size} capacity=#{capacity} item_class=#{item_class} pointer=#{pointer}>)
      end
    end
  end
end
