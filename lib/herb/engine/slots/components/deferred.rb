# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      module Components
        # A block whose primary content stays out of the initial response.
        #
        # The transform conditions the primary on an internal boolean state the
        # client steers, so the first render shows only the `<Fallback>` and the
        # block request is an ordinary steered refetch answering the primary
        # branch with its statics. `Async` requests on mount and `Lazy` when the
        # block nears the viewport.
        #
        class Deferred < Base
          ATTRIBUTES = Fragment::ATTRIBUTES #: Array[String]

          #: () -> Array[String]
          def allowed_attributes
            ATTRIBUTES
          end

          #: () -> Array[untyped]
          def transform
            refuse_unknown_attributes

            fallbacks, primary = children.partition { |child| Components.element?(child, Fallback::NAME) }

            primary = @visitor.transform_component_children(primary)

            if fallbacks.size > 1
              error("A `<#{tag_name}>` holds #{fallbacks.size} `<Fallback>` elements, and it can only stand one in.", @element.location, suggestion: "Keep one `<Fallback>` per `<#{tag_name}>`.")
            end

            fallback = fallbacks.first

            Fallback.new(fallback, @visitor).refuse_unknown_attributes if fallback

            state = @visitor.states.declare_internal_block
            if_node = deferred_conditional(state, primary, fallback)

            @visitor.record_deferred(if_node, mode: mode, state: state, timing: timing)

            [@visitor.erb_code_node(@visitor.states.internal_assignment(state)), if_node]
          end

          private

          #: () -> String
          def mode
            raise NotImplementedError, "#{self.class} names no mode"
          end

          #: (String, Array[untyped], untyped) -> untyped
          def deferred_conditional(state, primary, fallback)
            subsequent = nil

            if fallback
              subsequent = Herb::AST::ERBElseNode.build(
                location: fallback.location,
                tag_opening: Herb::Token.from(:erb_start, "<%"),
                content: Herb::Token.from(:erb_content, " else "),
                tag_closing: Herb::Token.from(:erb_end, "%>"),
                statements: @visitor.transform_component_children(fallback.body || [])
              )
            end

            Herb::AST::ERBIfNode.build(
              location: @element.location,
              tag_opening: Herb::Token.from(:erb_start, "<%"),
              content: Herb::Token.from(:erb_content, " if #{state} "),
              tag_closing: Herb::Token.from(:erb_end, "%>"),
              statements: primary,
              subsequent: subsequent,
              end_node: Herb::AST::ERBEndNode.build(
                location: @element.location,
                tag_opening: Herb::Token.from(:erb_start, "<%"),
                content: Herb::Token.from(:erb_content, " end "),
                tag_closing: Herb::Token.from(:erb_end, "%>")
              )
            )
          end
        end
      end
    end
  end
end
