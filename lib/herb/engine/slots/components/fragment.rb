# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      module Components
        # Suspense-like fallbacks for server-derived content.
        #
        # A fragment compiles its primary children into a synthesized single-arm
        # conditional the page renders on first load, and parks its `<Fallback>`
        # for the client to show the instant a state write invalidates a server
        # read inside it. `delay` and `hold` tune when the fallback appears and
        # how long it stays.
        #
        class Fragment < Base
          NAME = "Fragment" #: String
          ATTRIBUTES = ["delay", "hold", "on"].freeze #: Array[String]

          #: () -> Array[String]
          def allowed_attributes
            ATTRIBUTES
          end

          #: () -> Array[untyped]
          def transform
            refuse_unknown_attributes

            timing = self.timing
            fallbacks, primary = children.partition { |child| Components.element?(child, Fallback::NAME) }

            primary = @visitor.transform_component_children(primary)

            if fallbacks.size > 1
              error("A `<Fragment>` holds #{fallbacks.size} `<Fallback>` elements, and it can only stand one in.", @element.location, suggestion: "Keep one `<Fallback>` per `<Fragment>`.")
            end

            fallback = fallbacks.first

            unless fallback
              warning("`<Fragment>` holds no `<Fallback>`, so it wraps nothing and compiles away.", @element.location, suggestion: "Add a `<Fallback>` to stand in while its content is stale, or unwrap the children.")

              return primary
            end

            Fallback.new(fallback, @visitor).refuse_unknown_attributes
            refuse_nested_fragment(fallback)

            if_node = synthesized_conditional(primary)

            @visitor.record_fragment(if_node, fallback.body || [], timing.merge(masking))

            [if_node]
          end

          private

          # `on` narrows when the fallback shows. Without it any covered read
          # going stale masks the fragment, and with it only a write to one of
          # the named states does.
          #: () -> Hash[String, untyped]
          def masking
            named = attributes.find { |attribute| attribute_name(attribute) == "on" }

            return {} unless named

            states = static_value(named).to_s.split(/[,\s]+/).reject(&:empty?)

            if states.empty?
              error("`on` names the states that mask this `<Fragment>`, and it names none.", named.location, suggestion: %(Name at least one state, like `on="album"`.))

              return {}
            end

            { "on" => states }
          end

          #: (untyped) -> void
          def refuse_nested_fragment(fallback)
            (fallback.body || []).each do |child|
              next unless Components.element?(child, NAME)

              error("A `<Fragment>` sits inside a `<Fallback>`, which renders once and stays static, so nothing inside it can stay live.", child.location, suggestion: "Move the inner `<Fragment>` next to the outer one.")
            end
          end

          #: (Array[untyped]) -> untyped
          def synthesized_conditional(statements)
            Herb::AST::ERBIfNode.build(
              location: @element.location,
              tag_opening: Herb::Token.from(:erb_start, "<%"),
              content: Herb::Token.from(:erb_content, " if true "),
              tag_closing: Herb::Token.from(:erb_end, "%>"),
              statements: statements,
              subsequent: nil,
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
