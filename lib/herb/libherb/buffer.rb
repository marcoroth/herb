# frozen_string_literal: true
# typed: ignore

# rbs_inline: disabled

module Herb
  module LibHerb
    attach_function :hb_buffer_init, [:pointer], :bool
    attach_function :hb_buffer_free, [:pointer], :void
    attach_function :hb_buffer_value, [:pointer], :pointer
    attach_function :hb_buffer_length, [:pointer], :size_t
    attach_function :hb_buffer_capacity, [:pointer], :size_t
    attach_function :hb_buffer_sizeof, [], :size_t
    attach_function :hb_buffer_append, [:pointer, :pointer], :void

    class Buffer
      SIZEOF = LibHerb.hb_buffer_sizeof

      attr_reader :pointer

      def initialize(pointer)
        @pointer = pointer
      end

      def append(string)
        LibHerb.hb_buffer_append(pointer, string)
      end

      def value
        LibHerb.hb_buffer_value(pointer)
      end

      def length
        LibHerb.hb_buffer_length(pointer)
      end

      def capacity
        LibHerb.hb_buffer_capacity(pointer)
      end

      def read
        value.read_string(length)
      end

      def self.with
        FFI::MemoryPointer.new(SIZEOF) do |pointer|
          raise "couldn't allocate Buffer" unless LibHerb.hb_buffer_init(pointer)

          return yield new(pointer)
        ensure
          LibHerb.hb_buffer_free(pointer)
        end
      end
    end
  end
end
