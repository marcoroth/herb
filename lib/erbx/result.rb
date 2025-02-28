# frozen_string_literal: true

module ERBX
  class Result
    attr_reader :source, :warnings, :errors

    def initialize(source, warnings, errors)
      @source = source
      @warnings = warnings
      @errors = errors
    end
  end
end
