# frozen_string_literal: true
# typed: true

require_relative "base"

module Herb
  class Engine
    module Validators
      class AccessibilityValidator < Base
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
          error(message, location, code: type)
        end
      end
    end
  end
end
