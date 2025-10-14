# frozen_string_literal: true
# typed: true

require_relative "../validator"

module Herb
  class Engine
    module Validators
      class SecurityValidator < Validator
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

        def add_security_error(location, message, suggestion)
          add_diagnostic(message, location, :error, code: "SecurityViolation", source: "SecurityValidator",
                                                    suggestion: suggestion)
        end

        def add_diagnostic(message, location, severity, code: nil, source: nil, suggestion: nil)
          diagnostic = {
            message: message,
            location: location,
            severity: severity,
            code: code,
            source: source || self.class.name,
            suggestion: suggestion,
          }

          @diagnostics << diagnostic
        end
      end
    end
  end
end
