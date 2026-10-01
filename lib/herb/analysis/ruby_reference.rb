# frozen_string_literal: true
# typed: true

require "prism"

module Herb
  module Analysis
    # Answers whether a snippet of Ruby references a name, instead of merely containing its
    # characters. `render "form"` does not reference a local named `form`, and `item.title` does
    # not reference a local named `title`.
    #
    #     Herb::Analysis::RubyReference.references?("render 'form'", "form") #=> false
    #     Herb::Analysis::RubyReference.references?("render form", "form")   #=> true
    #
    # A name that cannot be parsed falls back to matching the source, since a dependency that is
    # missed goes stale while one that is imagined only costs a rebuild.
    #
    class RubyReference
      #: (String?, String?) -> bool
      def self.references?(code, name)
        source = code.to_s
        target = name.to_s.split(".").first.to_s

        return false if source.empty? || target.empty?
        return false unless source.include?(target)

        nodes = nodes_in(source)

        return source.match?(boundary(target)) unless nodes

        nodes.any? { |node| names?(node, target) }
      end

      #: (String) -> Regexp
      def self.boundary(target)
        target.start_with?("@") ? /#{Regexp.escape(target)}\b/ : /\b#{Regexp.escape(target)}\b/
      end

      #: (String) -> Array[untyped]?
      def self.nodes_in(source)
        result = Prism.parse(source)

        return nil if result.failure?

        found = [] #: Array[untyped]
        queue = [result.value] #: Array[untyped]

        while (node = queue.shift)
          found << node
          queue.concat(node.compact_child_nodes)
        end

        found
      rescue StandardError
        nil
      end

      #: (untyped, String) -> bool
      def self.names?(node, target)
        return node.receiver.nil? && node.name.to_s == target if node.is_a?(Prism::CallNode)
        return false unless node.respond_to?(:name)

        node.name.to_s == target
      end
    end
  end
end
