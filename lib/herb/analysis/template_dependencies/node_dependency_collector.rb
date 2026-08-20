# frozen_string_literal: true

require "prism"

module Herb
  module Analysis
    class TemplateDependencies
      class NodeDependencyCollector < ::Herb::Visitor
        BRANCH_BODY_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]
        BRANCH_CONTINUATION_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]
        ASSIGNMENT_NODES = [
          Prism::LocalVariableWriteNode,
          Prism::LocalVariableOrWriteNode,
          Prism::LocalVariableAndWriteNode,
          Prism::LocalVariableOperatorWriteNode,
        ].freeze #: Array[untyped]

        attr_reader :affected

        def initialize(state, helper_registry, custom_helpers, conditions_only: false)
          super()

          @state = state
          @conditions_only = conditions_only
          @helper_registry = helper_registry
          @custom_helpers = custom_helpers
          @affected = [] #: Array[Hash[Symbol, untyped]]
          @aliases = Set[state] #: Set[String]
          @path = [] #: Array[Integer]
          @child_index = [] #: Array[Integer]
        end

        def visit_document_node(node)
          visit_children_with_paths(node.children)
        end

        def visit_html_element_node(node)
          visit(node.open_tag) if node.open_tag

          visit_children_with_paths(node.body)
        end

        def visit_html_open_tag_node(node)
          node.child_nodes.each do |child|
            check_attribute(child, @path.dup) if child.is_a?(Herb::AST::HTMLAttributeNode)
          end
        end

        def visit_erb_content_node(node)
          check_erb_expression(node, :text_content)

          bind_assignments(node)
        end

        def visit_erb_if_node(node)
          check_block_for_state(node, :conditional)
        end

        def visit_erb_unless_node(node)
          check_block_for_state(node, :conditional)
        end

        def visit_erb_case_node(node)
          check_block_for_state(node, :conditional)
        end

        def visit_erb_node(node)
          check_erb_expression(node, :expression)
        end

        def visit_erb_render_node(node)
          check_erb_expression(node, :render)
        end

        def visit_erb_block_node(node)
          check_erb_expression(node, :expression)

          visit_branching_node(node)
        end

        def visit_erb_iteration_block_node(node)
          check_erb_expression(node, :iteration)

          visit_branching_node(node)
        end

        def visit_erb_while_node(node)
          check_erb_expression(node, :expression)

          visit_branching_node(node)
        end

        def visit_erb_until_node(node)
          check_erb_expression(node, :expression)

          visit_branching_node(node)
        end

        def visit_erb_for_node(node)
          check_erb_expression(node, :expression)

          visit_branching_node(node)
        end

        private

        def visit_children_with_paths(children)
          return unless children.is_a?(Array)

          children.each_with_index do |child, index|
            @path.push(index)
            visit(child)
            @path.pop
          end
        end

        def check_block_for_state(node, type)
          all_content = @conditions_only ? Array(own_expression(node)) : collect_all_expressions(node)

          if all_content.any? { |code| references_state?(code) }
            location = node.location
            condition = node.content&.value&.strip

            @affected << {
              node_path: @path.dup,
              type: type,
              expression: condition,
              location: location ? "#{location.start.line}:#{location.start.column}" : nil
            }
          end

          visit_branching_node(node)
        end

        def visit_branching_node(node)
          outer = @aliases.dup

          @aliases.merge(bindings_for(node))

          BRANCH_BODY_PROPERTIES.each do |property|
            next unless node.respond_to?(property)

            visit_children_with_paths(node.send(property))
          end

          BRANCH_CONTINUATION_PROPERTIES.each do |property|
            next unless node.respond_to?(property)

            child = node.send(property)
            next unless child

            visit(child)
          end
        ensure
          @aliases.replace(outer) if outer
        end

        def bind_assignments(node)
          code = node.content&.value&.strip

          return unless code

          assigned_names(code).each { |name| @aliases.add(name) }
        end

        def assigned_names(code)
          result = Prism.parse(code)

          return [] if result.errors.any?

          names = [] #: Array[String]
          collect_assignments(result.value, names)

          names
        end

        def collect_assignments(node, names)
          if ASSIGNMENT_NODES.any? { |type| node.is_a?(type) }
            right = right_hand_side(node)

            names << node.name.to_s if right && references_state?(right)
          end

          node.child_nodes.compact.each { |child| collect_assignments(child, names) }
        end

        def right_hand_side(node)
          return nil unless node.respond_to?(:value)

          value = node.value #: untyped

          value&.slice
        end

        def bindings_for(node)
          code = node.respond_to?(:content) ? node.content&.value&.strip : nil

          return [] unless code
          return [] unless references_state?(code)

          block_parameters(code) - @aliases.to_a
        end

        def block_parameters(code)
          result = Prism.parse("#{code}\nend")

          return [] if result.errors.any?

          names = [] #: Array[String]
          collect_parameters(result.value, names)

          names
        end

        def collect_parameters(node, names)
          names << node.name.to_s if node.is_a?(Prism::RequiredParameterNode) || node.is_a?(Prism::BlockParameterNode)

          node.child_nodes.compact.each { |child| collect_parameters(child, names) }
        end

        def own_expression(node)
          return nil unless node.respond_to?(:content)

          value = node.content&.value&.strip

          value unless value.nil? || value.empty?
        end

        def collect_all_expressions(node)
          expressions = [] #: Array[String]

          if node.respond_to?(:content) && node.content
            value = node.content.respond_to?(:value) ? node.content.value&.strip : nil

            expressions << value if value && !value.empty? # steep:ignore
          end

          children = node.respond_to?(:child_nodes) ? node.child_nodes.compact : [] # steep:ignore
          children.each { |child| expressions.concat(collect_all_expressions(child)) }

          expressions
        end

        def check_erb_expression(node, type)
          code = node.content&.value&.strip
          return unless code

          if references_state?(code)
            location = node.location

            @affected << {
              node_path: @path.dup,
              type: type,
              expression: code,
              location: location ? "#{location.start.line}:#{location.start.column}" : nil
            }
          end
        end

        def check_attribute(attribute_node, path)
          attribute_name = nil

          attribute_node.child_nodes.each do |child|
            if child.is_a?(Herb::AST::HTMLAttributeNameNode)
              first = child.child_nodes&.first

              attribute_name = if first.respond_to?(:content)
                                 content = first.content # steep:ignore
                                 content.respond_to?(:value) ? content.value : content.to_s
                               end
            end

            next unless child.is_a?(Herb::AST::HTMLAttributeValueNode)

            child.child_nodes&.each do |value_child|
              next unless value_child.respond_to?(:content) && value_child.content # steep:ignore

              content = value_child.content # steep:ignore
              code = (content.respond_to?(:value) ? content.value : content.to_s).strip
              next unless code && !code.empty? && references_state?(code)

              location = value_child.location # steep:ignore

              @affected << {
                node_path: path.dup,
                type: :attribute_value,
                attribute: attribute_name,
                expression: code,
                location: location ? "#{location.start.line}:#{location.start.column}" : nil
              }
            end
          end
        end

        def references_state?(code)
          return false unless code

          @aliases.any? { |name| references_name?(code, name) }
        end

        def references_name?(code, name)
          if name.start_with?("@")
            code.match?(/#{Regexp.escape(name)}\b/)
          elsif name.include?(".")
            constant = name.split(".").first
            code.include?(constant.to_s)
          else
            code.match?(/\b#{Regexp.escape(name)}\b/)
          end
        end
      end
    end
  end
end
