# frozen_string_literal: true
# typed: true

require_relative "base"

module Herb
  class Engine
    module Validators
      class SecurityValidator < Base
        def visit_html_open_tag_node(node)
          validate_tag_security(node)

          super
        end

        def visit_html_attribute_name_node(node)
          validate_attribute_name_security(node)

          super
        end

        private

        def validate_tag_security(node)
          node.children.each do |child|
            next if child.is_a?(Herb::AST::HTMLAttributeNode)
            next if child.is_a?(Herb::AST::WhitespaceNode)

            next unless child.is_a?(Herb::AST::ERBContentNode) && erb_outputs?(child)

            prism_node = child.prism

            next if prism_node && tag_attributes_prism_node?(prism_node)

            if prism_node && conditional_tag_attributes_prism_node?(prism_node)
              add_security_error(
                child.location,
                "Avoid using conditional `tag.attributes` in attribute position.",
                "Use `<% if ... %><%= tag.attributes(...) %><% end %>` instead."
              )

              next
            end

            add_security_error(
              child.location,
              "ERB output tags (<%= %>) are not allowed in attribute position.",
              "Use control flow (<% %>) with static attributes instead."
            )
          end
        end

        def validate_attribute_name_security(node)
          node.children.each do |child|
            next unless child.is_a?(Herb::AST::ERBContentNode) && erb_outputs?(child)

            add_security_error(
              child.location,
              "ERB output in attribute names is not allowed for security reasons.",
              "Use static attribute names with dynamic values instead."
            )
          end
        end

        def tag_attributes_prism_node?(prism_node)
          return false unless prism_node.is_a?(Prism::CallNode)
          return false unless prism_node.name == :attributes

          receiver = prism_node.receiver
          return false unless receiver.is_a?(Prism::CallNode)

          receiver.name == :tag
        end

        def conditional_tag_attributes_prism_node?(prism_node)
          if prism_node.is_a?(Prism::IfNode) || prism_node.is_a?(Prism::UnlessNode)
            body = prism_node.statements&.body
            return false unless body
            return false unless body.length == 1

            return tag_attributes_prism_node?(body.first)
          end

          if prism_node.is_a?(Prism::AndNode) || prism_node.is_a?(Prism::OrNode)
            return tag_attributes_prism_node?(prism_node.right)
          end

          false
        end

        def add_security_error(location, message, suggestion)
          error(message, location, code: "SecurityViolation", suggestion: suggestion, error_class: SecurityError)
        end
      end
    end
  end
end
