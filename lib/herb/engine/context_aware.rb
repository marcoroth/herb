# frozen_string_literal: true
# typed: false

require_relative "visitor_context"

module Herb
  class Engine
    # Opt-in for visitors that want the template information the engine was built with.
    #
    # `Herb::Visitor` is generated and holds no state, so a visitor asks for a context by
    # including this module. The engine then hands it one before it walks the AST:
    #
    #     class MyVisitor < Herb::Visitor
    #       include Herb::Engine::ContextAware
    #     end
    #
    #     Herb::Engine.new(source, filename: path, visitors: [MyVisitor.new])
    #
    # A context passed by the caller always wins over the one the engine supplies, so a
    # visitor can also be used on its own, without an engine.
    #
    module ContextAware
      #: () -> Herb::Engine::VisitorContext
      def context
        @context ||= VisitorContext.new
      end

      #: (Herb::Engine::VisitorContext) -> void
      def context=(context)
        @context = context
        @context_explicit = true
      end

      #: (Herb::Engine::VisitorContext) -> void
      def inherit_context(context)
        @context = context unless @context_explicit
      end
    end
  end
end
