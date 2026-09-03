# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      module Components
        # What every built-in component shares.
        #
        # A component receives the element it stands on and the slots visitor
        # transforming the template. It validates its attributes against its
        # `allowed_attributes` and answers the nodes that replace it.
        #
        class Base
          #: (untyped, untyped) -> Array[untyped]
          def self.transform(element, visitor)
            new(element, visitor).transform
          end

          #: (untyped, untyped) -> void
          def initialize(element, visitor)
            @element = element
            @visitor = visitor
          end

          #: () -> Array[untyped]
          def transform
            raise NotImplementedError, "#{self.class} does not transform"
          end

          #: () -> Array[String]
          def allowed_attributes
            []
          end

          #: () -> void
          def refuse_unknown_attributes
            allowed = allowed_attributes

            return if attributes.all? { |attribute|
              name = attribute_name(attribute).to_s

              name.start_with?("data-herb-") || allowed.include?(name)
            }

            if allowed.empty?
              error("`<#{tag_name}>` takes no attributes yet.", @element.location, suggestion: "Remove the attributes.")
            else
              error("`<#{tag_name}>` only takes #{allowed.map { |name| "`#{name}`" }.join(" and ")}.", @element.location, suggestion: "Remove the other attributes.")
            end
          end

          TIMING_ATTRIBUTES = ["delay", "hold", "poll"].freeze #: Array[String]

          private

          #: () -> Hash[String, Integer]
          def timing
            timed = {} #: Hash[String, Integer]

            attributes.each do |attribute|
              name = attribute_name(attribute).to_s

              next unless TIMING_ATTRIBUTES.include?(name) && allowed_attributes.include?(name)

              value = static_value(attribute)

              if value&.match?(/\A\d+\z/)
                timed[name] = Integer(value, 10)
              else
                error("`#{name}` on a `<#{tag_name}>` takes a whole number of milliseconds.", attribute.location, suggestion: %(Write it like `#{name}="150"`.))
              end
            end

            timed
          end

          #: () -> String
          def tag_name
            @element.tag_name&.value.to_s
          end

          #: () -> Array[untyped]
          def children
            @element.body || []
          end

          #: () -> Array[untyped]
          def attributes
            open_tag = @element.open_tag

            return [] unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

            (open_tag.children || []).grep(Herb::AST::HTMLAttributeNode)
          end

          #: (untyped) -> String?
          def attribute_name(attribute)
            parts = attribute.name&.children || []

            return nil if parts.empty?
            return nil unless parts.all?(Herb::AST::LiteralNode)

            parts.filter_map { |part| part.content if part.respond_to?(:content) }.join
          end

          #: (untyped) -> String?
          def static_value(attribute)
            parts = attribute.value&.children || []

            return nil unless parts.all?(Herb::AST::LiteralNode)

            parts.map { |part| part.content.to_s }.join.strip
          end

          #: (String, untyped, ?suggestion: String?) -> nil
          def error(message, location, suggestion: nil)
            @visitor.slot_error(message, location, :component, suggestion: suggestion)
          end

          #: (String, untyped, ?suggestion: String?) -> void
          def warning(message, location, suggestion: nil)
            @visitor.slot_warning(message, location, :component, suggestion: suggestion)
          end
        end
      end
    end
  end
end
