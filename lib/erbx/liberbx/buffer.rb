# frozen_string_literal: true

module ERBX
  module LibERBX
    attach_function :buffer_init, [:pointer], :bool
    attach_function :buffer_free, [:pointer], :void
    attach_function :buffer_value, [:pointer], :pointer
    attach_function :buffer_length, [:pointer], :size_t
    attach_function :buffer_capacity, [:pointer], :size_t
    attach_function :buffer_sizeof, [], :size_t

    class Buffer
      SIZEOF = LibERBX.buffer_sizeof

      attr_reader :pointer

      def initialize(pointer)
        @pointer = pointer
      end

      def value
        LibERBX.buffer_value(pointer)
      end

      def length
        LibERBX.buffer_length(pointer)
      end

      def capacity
        LibERBX.buffer_capacity(pointer)
      end

      def read
        value.read_string(length)
      end

      def self.with
        FFI::MemoryPointer.new(SIZEOF) do |pointer|
          raise "couldn't allocate Buffer" unless LibERBX.buffer_init(pointer)

          return yield new(pointer)
        ensure
          LibERBX.buffer_free(pointer)
        end
      end
    end
  end
end
