# frozen_string_literal: true

module Herb
  class Engine
    class ComponentVisitor < Herb::Visitor
      def visit_document_node(node)
        super
        replace_component_nodes_recursive(node)
      end

      private

      def replace_component_nodes_recursive(node)
        array_properties = [:children, :body, :statements]

        array_properties.each do |prop|
          next unless node.respond_to?(prop) && node.send(prop).is_a?(Array)

          array = node.send(prop)

          array.each_with_index do |child, index|
            if should_transform_to_component?(child)
              erb_node = transform_to_erb_component(child)
              array[index] = erb_node
            else
              replace_component_nodes_recursive(child)
            end
          end
        end

        node_properties = [:subsequent, :else_clause, :end_node, :rescue_clause, :ensure_clause]

        node_properties.each do |prop|
          if node.respond_to?(prop) && node.send(prop)
            child_node = node.send(prop)
            replace_component_nodes_recursive(child_node)
          end
        end
      end

      def should_transform_to_component?(node)
        return false unless node.is_a?(Herb::AST::HTMLElementNode)
        return false unless node.tag_name&.value

        node.tag_name.value.match?(/^[A-Z]/)
      end

      def transform_to_erb_component(element_node)
        tag_name = element_node.tag_name.value
        attributes = extract_attributes_from_element(element_node)

        component_code = build_component_code(tag_name, attributes, element_node)

        erb_start_token = create_token("TOKEN_ERB_START", "<%=")
        erb_content_token = create_token("TOKEN_ERB_CONTENT", " #{component_code} ")
        erb_end_token = create_token("TOKEN_ERB_END", "%>")

        Herb::AST::ERBContentNode.new(
          "ERBContentNode",
          element_node.location || dummy_location,
          [],
          erb_start_token,
          erb_content_token,
          erb_end_token,
          nil,
          false,
          true
        )
      end

      def extract_attributes_from_element(element_node)
        return {} unless element_node.open_tag&.children

        attributes = {}

        element_node.open_tag.children.each do |child|
          next unless child.is_a?(Herb::AST::HTMLAttributeNode)
          next unless child.name&.children&.first&.content
          next unless child.value&.children&.first&.content

          original_name = child.name.children.first.content
          attribute_value = child.value.children.first.content

          is_vue_directive = original_name.start_with?(":")

          attribute_name = original_name.sub(/^:/, "")
          attribute_name = attribute_name.gsub("-", "_")

          attributes[attribute_name] = {
            value: attribute_value,
            is_directive: is_vue_directive
          }
        end

        attributes
      end

      def build_component_code(tag_name, attributes, element_node)
        if attributes.empty? && (element_node.body.nil? || element_node.body.empty?)
          "render #{tag_name}.new"
        elsif attributes.empty?
          if has_complex_content?(element_node)
            "render #{tag_name}.new do\n#{extract_content_as_erb(element_node)}\nend"
          else
            content = extract_simple_content(element_node)
            "render #{tag_name}.new do\n#{content}\nend"
          end
        elsif element_node.body.nil? || element_node.body.empty?
          kwargs = attributes.map { |name, attr_data|
            "#{name}: #{format_attribute_value(attr_data[:value], attr_data[:is_directive])}"
          }.join(", ")

          "render #{tag_name}.new(#{kwargs})"
        else
          kwargs = attributes.map { |name, attr_data|
            "#{name}: #{format_attribute_value(attr_data[:value], attr_data[:is_directive])}"
          }.join(", ")

          if has_complex_content?(element_node)
            "render #{tag_name}.new(#{kwargs}) do\n#{extract_content_as_erb(element_node)}\nend"
          else
            content = extract_simple_content(element_node)

            "render #{tag_name}.new(#{kwargs}) do\n#{content}\nend"
          end
        end
      end

      def format_attribute_value(value, is_directive = false)
        if is_directive
          value
        else
          "\"#{value}\""
        end
      end

      def has_complex_content?(element_node)
        return false unless element_node.body

        element_node.body.any? do |child|
          child.is_a?(Herb::AST::HTMLElementNode) || child.is_a?(Herb::AST::ERBContentNode)
        end
      end

      def extract_simple_content(element_node)
        return "" unless element_node.body

        content_parts = element_node.body.filter_map do |child|
          child.content.strip if child.is_a?(Herb::AST::HTMLTextNode)
        end

        content_parts.join(" ").strip
      end

      def extract_content_as_erb(element_node)
        return "" unless element_node.body

        element_node.body.map { |child|
          case child
          when Herb::AST::HTMLTextNode
            child.content
          when Herb::AST::HTMLElementNode
            if should_transform_to_component?(child)
              transform_to_erb_component(child)
            else
              child.to_s
            end
          when Herb::AST::ERBContentNode
            child.to_s
          else
            child.to_s
          end
        }.join
      end

      def create_token(type, value)
        Herb::Token.new(value.dup, Range.zero, Location.zero, type.to_s)
      end
    end
  end
end
