# frozen_string_literal: true
# typed: true

module Herb
  class Result
    attr_reader :source #: String
    attr_reader :warnings #: Array
    attr_reader :errors #: Array[Herb::Errors::Error]

    #: (source: String, warnings: Array, errors: Array[Herb::Errors::Error]) -> void
    def initialize(source, warnings, errors)
      @source = source
      @warnings = warnings
      @errors = errors
    end

    #: () -> bool
    def success?
      false
    end

    #: () -> bool
    def failed?
      true
    end
  end
end
