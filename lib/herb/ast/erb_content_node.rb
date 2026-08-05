# frozen_string_literal: true
# typed: true

module Herb
  module AST
    class ERBContentNode < Node
      #: () -> Prism::node?
      def parsed_prism_node
        erb_content = @content&.value&.strip
        return nil unless erb_content

        begin
          require "prism"
        rescue LoadError
          return nil
        end

        prism_result = Prism.parse(erb_content)
        return nil unless prism_result.success?

        prism_result.value.statements.body.first
      end

      #: () -> Prism::node?
      def prism
        return @prism if defined?(@prism)

        @prism = deserialized_prism_node || parsed_prism_node
      end
    end
  end
end
