# frozen_string_literal: true
# typed: true

module Herb
  class Result
    #: String
    attr_reader :source
    #: Array[Herb::Warnings::Warning]
    attr_reader :warnings
    #: Array[Herb::Errors::Error]
    attr_reader :errors

    #: (String, Array[Herb::Warnings::Warning], Array[Herb::Errors::Error]) -> void
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
