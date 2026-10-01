# frozen_string_literal: true

module RuboCop
  module Herb
    class ProcessedSourceBuilder
      def self.call(code:, processed_source:)
        new(code, processed_source).call
      end

      def initialize(code, processed_source)
        @code = code
        @processed_source = processed_source
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
        source
      end
    end
  end
end
