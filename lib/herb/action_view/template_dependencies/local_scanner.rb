# frozen_string_literal: true

require "prism"
require "set"

module Herb
  module ActionView
    class TemplateDependencies
      class LocalScanner < ::Herb::Visitor
        attr_reader :locals

        def initialize
          super

          @locals = Set.new #: Set[String]
        end

        def visit_erb_node(node)
          return unless node.respond_to?(:deserialized_prism_node)

          prism_node = node.deserialized_prism_node

          if prism_node
            collect_locals(prism_node)
          end
        rescue StandardError
          nil
        end

        private

        def collect_locals(node)
          case node
          when Prism::LocalVariableWriteNode, Prism::LocalVariableOrWriteNode, Prism::LocalVariableAndWriteNode, Prism::LocalVariableOperatorWriteNode
            @locals.add(node.name.to_s)
          when Prism::MultiWriteNode
            node.lefts.each do |target|
              @locals.add(target.name.to_s) if target.respond_to?(:name) # steep:ignore
            end
          end

          node.child_nodes.compact.each { |child| collect_locals(child) }
        end
      end
    end
  end
end
