# frozen_string_literal: true
# typed: true

require_relative "../visitor"

module Herb
  class Engine
    # Asks the compiler to replace a `render` of a static partial with the partial itself, so the
    # rendered page costs no partial lookup at run time.
    #
    # It rewrites nothing on its own. The splice happens in the compiler, which is the only place
    # that can compile one template's tree into the middle of another, and this says the template
    # wants it done:
    #
    #     require "herb/engine/inline_render_visitor"
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::InlineRenderVisitor.new])
    #
    # A partial is inlined only when the compiler can be sure which file it means and that inlining
    # it changes nothing: a literal path, no block, no `content_for`, no `yield`, no
    # `local_assigns`, and not one already being inlined further up. Anything else is left as the
    # `render` call it was written as.
    class InlineRenderVisitor < Herb::Visitor
      recommended_parser_option render_nodes: true

      # The engine asks this rather than being told through an option, so that wanting the
      # optimization and having it are the same thing.
      #: () -> bool
      def self.inlines_renders?
        true
      end

      # The partial's markup ends up in the compiled output of the template that rendered it, which
      # is the whole point and also the thing that makes it a rewriter.
      #: () -> bool
      def self.rewrites_erb_source?
        true
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end
    end
  end
end
