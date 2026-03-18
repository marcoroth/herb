# frozen_string_literal: true

module Herb
  class ParserOptions
    attr_reader :strict #: bool
    attr_reader :track_whitespace #: bool
    attr_reader :analyze #: bool
    attr_reader :action_view_helpers #: bool
    attr_reader :render_nodes #: bool
    attr_reader :prism_program #: bool
    attr_reader :prism_nodes #: bool
    attr_reader :prism_nodes_deep #: bool

    DEFAULT_STRICT = true #: bool
    DEFAULT_TRACK_WHITESPACE = false #: bool
    DEFAULT_ANALYZE = true #: bool
    DEFAULT_ACTION_VIEW_HELPERS = false #: bool
    DEFAULT_RENDER_NODES = false #: bool
    DEFAULT_PRISM_PROGRAM = false #: bool
    DEFAULT_PRISM_NODES = false #: bool
    DEFAULT_PRISM_NODES_DEEP = false #: bool

    #: (?strict: bool, ?track_whitespace: bool, ?analyze: bool, ?action_view_helpers: bool, ?prism_nodes: bool, ?prism_nodes_deep: bool, ?prism_program: bool) -> void
    def initialize(strict: DEFAULT_STRICT, track_whitespace: DEFAULT_TRACK_WHITESPACE, analyze: DEFAULT_ANALYZE, action_view_helpers: DEFAULT_ACTION_VIEW_HELPERS, render_nodes: DEFAULT_RENDER_NODES, prism_nodes: DEFAULT_PRISM_NODES, prism_nodes_deep: DEFAULT_PRISM_NODES_DEEP, prism_program: DEFAULT_PRISM_PROGRAM)
      @strict = strict
      @track_whitespace = track_whitespace
      @analyze = analyze
      @action_view_helpers = action_view_helpers
      @render_nodes = render_nodes
      @prism_nodes = prism_nodes
      @prism_nodes_deep = prism_nodes_deep
      @prism_program = prism_program
    end

    #: () -> Hash[Symbol, bool]
    def to_h
      {
        strict: @strict,
        track_whitespace: @track_whitespace,
        analyze: @analyze,
        action_view_helpers: @action_view_helpers,
        render_nodes: @render_nodes,
        prism_nodes: @prism_nodes,
        prism_nodes_deep: @prism_nodes_deep,
        prism_program: @prism_program,
      }
    end

    #: () -> String
    def inspect
      "#<#{self.class.name}\n  " \
        "strict=#{@strict}\n  " \
        "track_whitespace=#{@track_whitespace}\n  " \
        "analyze=#{@analyze}\n  " \
        "action_view_helpers=#{@action_view_helpers}\n  " \
        "render_nodes=#{@render_nodes}\n  " \
        "prism_nodes=#{@prism_nodes}\n  " \
        "prism_nodes_deep=#{@prism_nodes_deep}\n  " \
        "prism_program=#{@prism_program}>"
    end
  end
end
