# frozen_string_literal: true

module Herb
  class ParserOptions
    attr_reader :strict #: bool
    attr_reader :track_whitespace #: bool
    attr_reader :track_locations #: bool
    attr_reader :analyze #: bool
    attr_reader :action_view_helpers #: bool
    attr_reader :transform_conditionals #: bool
    attr_reader :render_nodes #: bool
    attr_reader :strict_locals #: bool
    attr_reader :iteration_nodes #: bool
    attr_reader :prism_program #: bool
    attr_reader :prism_nodes #: bool
    attr_reader :prism_nodes_deep #: bool
    attr_reader :timeout #: Numeric
    attr_reader :max_errors #: Integer?
    attr_reader :arena_stats #: bool

    DEFAULT_STRICT = true #: bool
    DEFAULT_TRACK_WHITESPACE = false #: bool
    DEFAULT_TRACK_LOCATIONS = true #: bool
    DEFAULT_ANALYZE = true #: bool
    DEFAULT_ACTION_VIEW_HELPERS = false #: bool
    DEFAULT_TRANSFORM_CONDITIONALS = false #: bool
    DEFAULT_RENDER_NODES = false #: bool
    DEFAULT_STRICT_LOCALS = false #: bool
    DEFAULT_ITERATION_NODES = false #: bool
    DEFAULT_PRISM_PROGRAM = false #: bool
    DEFAULT_PRISM_NODES = false #: bool
    DEFAULT_PRISM_NODES_DEEP = false #: bool
    DEFAULT_TIMEOUT = 1 #: Numeric
    DEFAULT_MAX_ERRORS = 25 #: Integer
    DEFAULT_CAPTURE_ARENA_STATS = false #: bool

    #: (?strict: bool, ?track_whitespace: bool, ?track_locations: bool, ?analyze: bool, ?action_view_helpers: bool, ?transform_conditionals: bool, ?render_nodes: bool, ?strict_locals: bool, ?iteration_nodes: bool, ?prism_nodes: bool, ?prism_nodes_deep: bool, ?prism_program: bool, ?timeout: Numeric) -> void
    def initialize(strict: DEFAULT_STRICT, track_whitespace: DEFAULT_TRACK_WHITESPACE, track_locations: DEFAULT_TRACK_LOCATIONS, analyze: DEFAULT_ANALYZE, action_view_helpers: DEFAULT_ACTION_VIEW_HELPERS, transform_conditionals: DEFAULT_TRANSFORM_CONDITIONALS, render_nodes: DEFAULT_RENDER_NODES, strict_locals: DEFAULT_STRICT_LOCALS, iteration_nodes: DEFAULT_ITERATION_NODES, prism_nodes: DEFAULT_PRISM_NODES, prism_nodes_deep: DEFAULT_PRISM_NODES_DEEP, prism_program: DEFAULT_PRISM_PROGRAM, timeout: DEFAULT_TIMEOUT, max_errors: DEFAULT_MAX_ERRORS, arena_stats: DEFAULT_CAPTURE_ARENA_STATS)
      @strict = strict
      @track_whitespace = track_whitespace
      @track_locations = track_locations
      @analyze = analyze
      @action_view_helpers = action_view_helpers
      @transform_conditionals = transform_conditionals
      @render_nodes = render_nodes
      @strict_locals = strict_locals
      @iteration_nodes = iteration_nodes
      @prism_nodes = prism_nodes
      @prism_nodes_deep = prism_nodes_deep
      @prism_program = prism_program
      @timeout = timeout
      @max_errors = max_errors
      @arena_stats = arena_stats
    end

    #: () -> Hash[Symbol, (bool | Numeric | nil)]
    def to_h
      {
        strict: @strict,
        track_whitespace: @track_whitespace,
        track_locations: @track_locations,
        analyze: @analyze,
        action_view_helpers: @action_view_helpers,
        transform_conditionals: @transform_conditionals,
        render_nodes: @render_nodes,
        strict_locals: @strict_locals,
        iteration_nodes: @iteration_nodes,
        prism_nodes: @prism_nodes,
        prism_nodes_deep: @prism_nodes_deep,
        prism_program: @prism_program,
        timeout: @timeout,
        max_errors: @max_errors,
        arena_stats: @arena_stats,
      }
    end

    #: () -> String
    def inspect
      "#<#{self.class.name}\n  " \
        "strict=#{@strict}\n  " \
        "track_whitespace=#{@track_whitespace}\n  " \
        "track_locations=#{@track_locations}\n  " \
        "analyze=#{@analyze}\n  " \
        "action_view_helpers=#{@action_view_helpers}\n  " \
        "transform_conditionals=#{@transform_conditionals}\n  " \
        "render_nodes=#{@render_nodes}\n  " \
        "strict_locals=#{@strict_locals}\n  " \
        "iteration_nodes=#{@iteration_nodes}\n  " \
        "prism_nodes=#{@prism_nodes}\n  " \
        "prism_nodes_deep=#{@prism_nodes_deep}\n  " \
        "prism_program=#{@prism_program}\n  " \
        "timeout=#{@timeout}\n  " \
        "max_errors=#{@max_errors}>\n  " \
        "arena_stats=#{@arena_stats}>"
    end
  end
end
