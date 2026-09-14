# frozen_string_literal: true
# typed: false

require_relative "context"

module Herb
  class Visitor
    # Opt-in for visitors that want the template information the engine was built with.
    #
    # `Herb::Visitor` is generated and holds no state, so a visitor asks for a context by
    # including this module. The engine then hands it one before it walks the AST:
    #
    #     class MyVisitor < Herb::Visitor
    #       include Herb::Visitor::ContextAware
    #     end
    #
    #     Herb::Engine.new(source, filename: path, visitors: [MyVisitor.new])
    #
    # A context passed by the caller always wins over the one the engine supplies, so a
    # visitor can also be used on its own, without an engine.
    #
    module ContextAware
      #: () -> Herb::Visitor::Context
      def context
        @context ||= Context.new
      end

      #: (Herb::Visitor::Context) -> void
      def context=(context)
        @context = context
        @context_explicit = true
      end

      #: (Herb::Visitor::Context) -> void
      def inherit_context(context)
        @context = context unless @context_explicit
      end

      #: () -> Herb::Visitor::Context::Origin
      def origin
        context.origin
      end
    end
  end
end
