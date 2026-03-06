# frozen_string_literal: true

module Herb
  class ParserOptions
    attr_reader :strict #: bool
    attr_reader :track_whitespace #: bool
    attr_reader :analyze #: bool

    DEFAULT_STRICT = true #: bool
    DEFAULT_TRACK_WHITESPACE = false #: bool
    DEFAULT_ANALYZE = true #: bool

    #: (?strict: bool, ?track_whitespace: bool, ?analyze: bool) -> void
    def initialize(strict: DEFAULT_STRICT, track_whitespace: DEFAULT_TRACK_WHITESPACE, analyze: DEFAULT_ANALYZE)
      @strict = strict
      @track_whitespace = track_whitespace
      @analyze = analyze
    end

    #: () -> Hash[Symbol, bool]
    def to_h
      {
        strict: @strict,
        track_whitespace: @track_whitespace,
        analyze: @analyze,
      }
    end

    #: () -> String
    def inspect
      "#<#{self.class.name} strict=#{@strict} track_whitespace=#{@track_whitespace} analyze=#{@analyze}>"
    end
  end
end
