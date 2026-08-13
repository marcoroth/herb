# frozen_string_literal: true

require "prism"
require "set"

module Herb
  module Analysis
    class TemplateDependencies
      class DependencyCollector < ::Herb::Visitor
        attr_reader :instance_variables, :constants, :locals_declared, :locals_received, :helper_calls, :unknown_calls, :render_calls

        def initialize(helper_registry, custom_helpers, prescanned_locals = Set.new)
          super()

          @helper_registry = helper_registry
          @custom_helpers = custom_helpers
          @instance_variables = Set.new
          @constants = Set.new
          @locals_declared = Set.new
          @locals_received = {} #: Hash[String, String]
          @helper_calls = Set.new
          @unknown_calls = Set.new
          @known_locals = prescanned_locals.dup
          @render_calls = [] #: Array[Hash[Symbol, untyped]]
        end

        def visit_erb_node(node)
          # `<%# ... %>` is prose, not code. Parsing it yields bogus calls from ordinary words.
          return if node.tag_opening&.value&.start_with?("<%#")

          analyze_erb_node(node)
        end

        def visit_erb_render_node(node)
          locals = {} #: Hash[String, String]

          node.keywords&.locals&.each do |local|
            name = local.name&.value
            value = local.value&.content

            next unless name && value

            value = name if value == "#{name}:"
            @locals_received[name] = value
            locals[name] = value

            analyze_ruby_expression(value)
          end

          if node.static_partial?
            @render_calls << {
              partial: node.partial_path,
              locals: locals,
              collection: node.keywords&.collection&.value,
              as_name: node.keywords&.as_name&.value&.strip&.delete_prefix(":")&.delete_prefix('"')&.delete_suffix('"')
            }
          end

          if node.keywords&.collection
            analyze_ruby_expression(node.keywords.collection.value)
          end

          super
        end

        def visit_erb_strict_locals_node(node)
          node.locals&.each do |param|
            @locals_declared.add(param.name&.value) if param.name&.value
            @known_locals.add(param.name&.value) if param.name&.value
          end

          super
        end

        private

        def analyze_erb_node(erb_node)
          prism_node = erb_node.deserialized_prism_node if erb_node.respond_to?(:deserialized_prism_node)

          if prism_node
            walk_prism_node(prism_node)
          else
            analyze_ruby_expression(erb_node.content&.value&.strip)
          end
        rescue StandardError
          nil
        end

        def analyze_ruby_expression(code)
          return if code.nil? || code.empty?

          result = Prism.parse(code)
          return if result.errors.any?

          walk_prism_node(result.value)
        rescue StandardError
          nil
        end

        def walk_prism_node(node)
          case node
          when Prism::InstanceVariableReadNode
            @instance_variables.add(node.name.to_s)
          when Prism::LocalVariableWriteNode,
              Prism::LocalVariableOrWriteNode,
              Prism::LocalVariableAndWriteNode,
              Prism::LocalVariableOperatorWriteNode
            @known_locals.add(node.name.to_s)
          when Prism::BlockParameterNode, Prism::RequiredParameterNode
            @known_locals.add(node.name.to_s)
          when Prism::ConstantReadNode
            # Standalone constants are just references, not state
          when Prism::CallNode
            check_call_node(node)
          when Prism::LocalVariableReadNode
            @known_locals.add(node.name.to_s)
          end

          node.child_nodes.compact.each { |child| walk_prism_node(child) }
        end

        def check_call_node(node)
          name = node.name.to_s

          if node.receiver.nil?
            if @helper_registry.include?(name)
              @helper_calls.add(name)
            elsif @custom_helpers.include?(name)
              @helper_calls.add(name)
            elsif name == "render"
              # render calls are handled by visit_erb_render_node
            elsif !@known_locals.include?(name) && !@locals_received.key?(name) && !@locals_declared.include?(name)
              @unknown_calls.add(name)
            end
          elsif node.receiver.is_a?(Prism::ConstantReadNode)
            @constants.add("#{node.receiver.name}.#{name}")
          end
        end
      end
    end
  end
end
