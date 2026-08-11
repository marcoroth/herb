# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    # Asks the parser to resolve Action View helpers into the markup they produce, so the compiler
    # emits that markup directly instead of a call the renderer has to make.
    #
    # It rewrites nothing itself. The work happens in the parser, and this says the template wants
    # it done:
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::OptimizeVisitor.new])
    #
    # Inserting it is the whole opt-in. There is no check first for whether a template looks like
    # it contains helpers, because a caller that added this has already answered that question.
    class OptimizeVisitor < Herb::Visitor
      required_parser_option action_view_helpers: true, transform_conditionals: true

      # @rbs!
      #   def self.experimental_warning_issued: () -> bool
      #   def self.experimental_warning_issued=: (bool) -> bool

      class << self
        attr_accessor :experimental_warning_issued #: bool
      end

      self.experimental_warning_issued = false

      #: () -> void
      def initialize
        super

        return if self.class.experimental_warning_issued

        self.class.experimental_warning_issued = true

        warn "[Herb] Compile-time optimizations are experimental. Output may differ from standard ActionView rendering."
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end
    end
  end
end
