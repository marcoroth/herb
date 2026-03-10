# frozen_string_literal: true

module Herb
  class ParserOptions
    attr_reader :strict #: bool
    attr_reader :track_whitespace #: bool
    attr_reader :analyze #: bool
    attr_reader :action_view_helpers #: bool

    DEFAULT_STRICT = true #: bool
    DEFAULT_TRACK_WHITESPACE = false #: bool
    DEFAULT_ANALYZE = true #: bool
    DEFAULT_ACTION_VIEW_HELPERS = false #: bool

    #: (?strict: bool, ?track_whitespace: bool, ?analyze: bool, ?action_view_helpers: bool) -> void
    def initialize(strict: DEFAULT_STRICT, track_whitespace: DEFAULT_TRACK_WHITESPACE, analyze: DEFAULT_ANALYZE, action_view_helpers: DEFAULT_ACTION_VIEW_HELPERS)
      @strict = strict
      @track_whitespace = track_whitespace
      @analyze = analyze
      @action_view_helpers = action_view_helpers
    end

    #: () -> Hash[Symbol, bool]
    def to_h
      {
        strict: @strict,
        track_whitespace: @track_whitespace,
        analyze: @analyze,
        action_view_helpers: @action_view_helpers,
      }
    end

    #: () -> String
    def inspect
      "#<#{self.class.name} strict=#{@strict} track_whitespace=#{@track_whitespace} analyze=#{@analyze} action_view_helpers=#{@action_view_helpers}>"
    end
  end
end
