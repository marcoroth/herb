# frozen_string_literal: true
# typed: true

require_relative "base"

module Herb
  class Engine
    module Validators
      # Reports a template that writes literal ERB, which is a generator template and not a page.
      #
      # The engine itself compiles `<%%` to the literal `<%` the way Erubi does, so a sweep over a
      # project's templates gets one of these instead of a file it cannot make sense of.
      class GeneratorTemplateValidator < Base
        def visit_erb_node(node)
          validate_not_escaped(node)

          super
        end

        private

        def validate_not_escaped(node)
          opening = node.tag_opening&.value
          return unless opening && erb_escaped?(opening)

          error(
            "This file appears to be a generator template (a template used to generate ERB files) " \
            "rather than a standard ERB template. It contains escaped ERB tags like #{opening} %> " \
            "which produce literal ERB output in the generated file.",
            node.location,
            code: "GeneratorTemplate",
            suggestion: "Compile it without this validator to get the literal ERB output.",
            error_class: GeneratorTemplateError
          )
        end
      end
    end
  end
end
