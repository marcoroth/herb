# frozen_string_literal: true

module Herb
  class LexResult < Result
    attr_reader :value #: TokenList

    #: (Array[Herb::Token], String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error]) -> void
    def initialize(value, source, warnings, errors)
      @value = TokenList.new(value)
      super(source, warnings, errors)
    end

    #: () -> bool
    def success?
      errors.empty?
    end

    #: () -> bool
    def failed?
      errors.any?
    end

    #: (Hash[untyped, untyped]) -> LexResult
    def self.from_hash(data)
      tokens_data = data[:value] || data["value"] || []
      warnings_data = data[:warnings] || data["warnings"] || []
      errors_data = data[:errors] || data["errors"] || []
      source = data[:source] || data["source"] || ""

      tokens = tokens_data.map { |token_data| Token.from_hash(token_data) }
      warnings = warnings_data.map { |warning_data| Herb::Warnings::Warning.from_hash(warning_data) }
      errors = errors_data.map { |error_data| Herb::Errors::Error.from_hash(error_data) }

      new(tokens, source, warnings, errors)
    end
  end
end
