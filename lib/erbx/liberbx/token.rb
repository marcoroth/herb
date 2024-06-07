# frozen_string_literal: true

module ERBX
  module LibERBX
    attach_function :token_type_string, [:int], :pointer
    attach_function :token_value, [:pointer], :pointer
    attach_function :token_type, [:pointer], :int

    class Token
      attr_reader :pointer

      def initialize(pointer)
        @pointer = pointer
      end

      def value
        @value ||= LibERBX.token_value(pointer).read_string
      end

      def type
        @type ||= LibERBX.token_type_string(type_int).read_string
      end

      def type_int
        @type_int ||= LibERBX.token_type(pointer)
      end

      def inspect
        %(#<#{self.class} type="#{type}" value="#{value}">)
      end
    end
  end
end
