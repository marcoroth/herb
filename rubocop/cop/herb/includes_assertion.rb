# frozen_string_literal: true

module RuboCop
  module Cop
    module Herb
      # Checks for `assert_includes` and `refute_includes` in tests.
      #
      # @example
      #   # bad
      #   assert_includes result.errors.first.message, "unexpected token"
      #
      #   # good
      #   assert_parsed_snapshot(source)
      #
      class IncludesAssertion < Base
        MSG = "Do not use `%<method>s`. Use one of the `assert_*_snapshot` helpers instead."

        RESTRICT_ON_SEND = [:assert_includes, :refute_includes].freeze

        def on_send(node)
          return if node.receiver

          add_offense(node.loc.selector, message: format(MSG, method: node.method_name))
        end
      end
    end
  end
end
