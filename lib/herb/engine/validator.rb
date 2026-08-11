# frozen_string_literal: true

require_relative "context_aware"
require_relative "diagnostics"

module Herb
  class Engine
    # A visitor that reads the tree and reports what it finds without rewriting anything.
    #
    # Reporting itself lives in `Herb::Engine::Diagnostics` and is available to any visitor, so
    # this class is only the convenience of the two mixins plus an enabled flag. A validator that
    # wants to be one of the engine's own is expected to subclass it; a validator that comes from
    # somewhere else can just include the mixins.
    class Validator < Herb::Visitor
      include ContextAware
      include Diagnostics

      attr_reader :enabled #: bool

      #: (?enabled: bool) -> void
      def initialize(enabled: true)
        super()

        @enabled = enabled
      end

      #: () -> bool
      def enabled?
        @enabled
      end

      #: (Herb::AST::Node) -> void
      def validate(node)
        visit(node)
      end
    end
  end
end
