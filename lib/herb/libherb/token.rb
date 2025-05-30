# frozen_string_literal: true
# typed: ignore

module Herb
  module LibHerb
    attach_function :token_to_string, [:pointer], :string
    attach_function :token_to_json, [:pointer], :string
    attach_function :token_type_to_string, [:int], :pointer
    attach_function :token_value, [:pointer], :pointer
    attach_function :token_type, [:pointer], :int

    class Token
      attr_reader :pointer

      def initialize(pointer)
        @pointer = pointer
      end

      def value
        @value ||= LibHerb.token_value(pointer).read_string
      end

      def type
        @type ||= LibHerb.token_type_to_string(type_int).read_string
      end

      def type_int
        @type_int ||= LibHerb.token_type(pointer)
      end

      def inspect
        LibHerb.token_to_string(pointer).force_encoding("utf-8")
      end

      def as_json
        JSON.parse(to_json)
      end

      def to_json(*_args)
        LibHerb.token_to_json(pointer).force_encoding("utf-8")
      end
    end
  end
end
