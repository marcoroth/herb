# frozen_string_literal: true

module RuboCop
  module Herb
    class ProcessedSourceBuilder
      def self.call(code:, processed_source:, ruby_ranges:)
        new(code, processed_source, ruby_ranges).call
      end

      def initialize(code, processed_source, ruby_ranges)
        @code = code
        @processed_source = processed_source
        @ruby_ranges = ruby_ranges
      end

      def call
        source = ::RuboCop::ProcessedSource.new(
          @code,
          @processed_source.ruby_version,
          @processed_source.path,
          parser_engine: @processed_source.parser_engine
        )
        source.config = @processed_source.config
        source.registry = @processed_source.registry
        source.define_singleton_method(:herb_ruby_ranges) { @ruby_ranges }
        source.instance_variable_set(:@ruby_ranges, @ruby_ranges)
        source.buffer.define_singleton_method(:herb_ruby_ranges) { @ruby_ranges }
        source.buffer.instance_variable_set(:@ruby_ranges, @ruby_ranges)
        source
      end
    end
  end
end
