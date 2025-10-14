# frozen_string_literal: true
# typed: true

require_relative "../validator"

module Herb
  class Engine
    module Validators
      class AccessibilityValidator < Validator
        def visit_html_attribute_node(node)
          validate_attribute(node)
          super
        end

        private

        def validate_attribute(node)
          # TODO: Add accessibility attribute validation
        end

        def validate_id_format(node)
          # TODO: Add ID format validation
        end

        def add_validation_error(type, location, message)
          error(message, location, code: type, source: "AccessibilityValidator")
        end
      end
    end
  end
end
