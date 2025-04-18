# frozen_string_literal: true

module Herb
  class Result
    attr_reader :source, :warnings, :errors

    def initialize(source, warnings, errors)
      @source = source
      @warnings = warnings
      @errors = errors
    end

    def success?
      false
    end

    def failed?
      true
    end
  end
end
