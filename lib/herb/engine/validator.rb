# frozen_string_literal: true

require_relative "../visitor"
require_relative "context_aware"
require_relative "diagnostics"

module Herb
  class Engine
    # A visitor that reads the tree and reports what it finds without rewriting anything.
    #
    # Whether a validator runs at all is decided by whoever builds the visitor stack: one that is
    # not wanted is simply not inserted. What is left for the validator itself is whether what it
    # finds is worth refusing to compile over, which is a decision that changes between
    # environments rather than between templates:
    #
    #     Herb::Engine::Validators::SecurityValidator.new(fatal: false)
    #
    # A fatal validator aborts compilation when it reports an error. A validator that is not fatal
    # reports the same thing and lets the template compile, so the page still renders and the
    # finding reaches the browser instead.
    #
    # Reporting itself lives in `Herb::Engine::Diagnostics` and is open to any visitor, so a
    # validator from somewhere else can include the mixins rather than subclass this.
    class Validator < Herb::Visitor
      include ContextAware
      include Diagnostics

      #: (?fatal: bool) -> void
      def initialize(fatal: true)
        super()

        @fatal = fatal
      end

      #: () -> bool
      def fatal?
        @fatal
      end

      #: () -> String
      def inspect
        "#<#{self.class.name} fatal=#{fatal?}>"
      end
    end
  end
end
