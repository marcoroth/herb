# frozen_string_literal: true
# rbs_inline: enabled

module Herb
  module AST
    module NodeBuilder
      #: (tag_name: String, ?attributes: Array[Herb::AST::HTMLAttributeNode], ?body: Array[Herb::AST::Node], ?is_void: bool, ?element_source: String) -> Herb::AST::HTMLElementNode
      def build_element(tag_name:, attributes: [], body: [], is_void: false, element_source: "Transformer")
        tag_name_token = build_token(:tag_name, tag_name)

        open_tag = HTMLOpenTagNode.new(
          "HTMLOpenTagNode",
          Location.zero,
          [],
          build_token(:tag_opening, "<"),
          tag_name_token,
          build_token(:tag_closing, is_void ? " />" : ">"),
          attributes,
          is_void
        )

        close_tag = unless is_void
                      HTMLCloseTagNode.new(
                        "HTMLCloseTagNode",
                        Location.zero,
                        [],
                        build_token(:tag_opening, "</"),
                        build_token(:tag_name, tag_name),
                        [],
                        build_token(:tag_closing, ">")
                      )
                    end

        HTMLElementNode.new(
          "HTMLElementNode",
          Location.zero,
          [],
          open_tag,
          tag_name_token,
          body,
          close_tag,
          is_void,
          element_source
        )
      end

      #: (String, ?(String | nil)) -> Herb::AST::HTMLAttributeNode
      def build_attribute(name, value = nil) # rubocop:disable Metrics/MethodLength
        name_literal = build_literal(name)
        name_node = HTMLAttributeNameNode.new(
          "HTMLAttributeNameNode", Location.zero, [], [name_literal]
        )

        if value.nil?
          return HTMLAttributeNode.new(
            "HTMLAttributeNode", Location.zero, [], name_node, nil, nil
          )
        end

        value_node = HTMLAttributeValueNode.new(
          "HTMLAttributeValueNode", Location.zero, [],
          build_token(:quote, '"'),
          [build_literal(value)],
          build_token(:quote, '"'),
          true
        )

        equals_token = build_token(:equals, "=")

        HTMLAttributeNode.new(
          "HTMLAttributeNode", Location.zero, [], name_node, equals_token, value_node
        )
      end

      #: (String, String) -> Herb::AST::HTMLAttributeNode
      def build_attribute_with_erb(name, ruby_expression)
        name_literal = build_literal(name)

        name_node = HTMLAttributeNameNode.new(
          "HTMLAttributeNameNode", Location.zero, [], [name_literal]
        )

        ruby_literal = RubyLiteralNode.new(
          "RubyLiteralNode", Location.zero, [], ruby_expression.dup
        )

        value_node = HTMLAttributeValueNode.new(
          "HTMLAttributeValueNode", Location.zero, [],
          build_token(:quote, '"'),
          [ruby_literal],
          build_token(:quote, '"'),
          true
        )

        equals_token = build_token(:equals, "=")

        HTMLAttributeNode.new(
          "HTMLAttributeNode", Location.zero, [], name_node, equals_token, value_node
        )
      end

      #: (String | Symbol) -> Herb::AST::LiteralNode
      def build_literal(value)
        LiteralNode.from(value)
      end

      #: (String) -> Herb::AST::HTMLTextNode
      def build_text(content)
        HTMLTextNode.new(
          "HTMLTextNode", Location.zero, [], content.dup
        )
      end

      #: (Symbol, String) -> Herb::Token
      def build_token(type, value)
        Token.new(value.dup, Range.zero, Location.zero, type.to_s)
      end

      #: (Herb::AST::Node, tag_name: String, ?attributes: Array[Herb::AST::HTMLAttributeNode], ?element_source: String) -> Herb::AST::HTMLElementNode
      def wrap_in_element(node, tag_name:, attributes: [], element_source: "Transformer")
        build_element(
          tag_name: tag_name,
          attributes: attributes,
          body: [node],
          element_source: element_source
        )
      end

      #: (Array[Herb::AST::Node], Herb::AST::Node, Herb::AST::Node) -> void
      def replace_node(parent_array, old_node, new_node)
        index = parent_array.index(old_node)
        parent_array[index] = new_node if index
      end

      #: (Array[Herb::AST::Node], Herb::AST::Node, Herb::AST::Node) -> void
      def insert_before(parent_array, reference_node, new_node)
        index = parent_array.index(reference_node)
        parent_array.insert(index, new_node) if index
      end

      #: (Array[Herb::AST::Node], Herb::AST::Node, Herb::AST::Node) -> void
      def insert_after(parent_array, reference_node, new_node)
        index = parent_array.index(reference_node)
        parent_array.insert(index + 1, new_node) if index
      end

      #: (Array[Herb::AST::Node], Herb::AST::Node) -> void
      def remove_node(parent_array, node)
        parent_array.delete(node)
      end

      #: (Herb::AST::HTMLElementNode, String) -> void
      def rename_tag(element, new_name)
        element.tag_name.value = new_name if element.tag_name

        if element.open_tag.tag_name
          element.open_tag.tag_name.value = new_name
        end

        return unless element.close_tag&.tag_name

        element.close_tag.tag_name.value = new_name
      end

      #: (Herb::AST::HTMLElementNode, String, ?String?) -> void
      def add_attribute(element, name, value = nil)
        attribute = value ? build_attribute(name, value) : build_attribute(name)
        element.open_tag.children << attribute
      end

      #: (Herb::AST::HTMLElementNode, String) -> void
      def remove_attribute(element, name)
        element.open_tag.children.reject! do |child|
          next false unless child.is_a?(HTMLAttributeNode)
          next false unless child.name&.children&.first

          child.name.children.first.content == name
        end
      end

      #: (Herb::AST::HTMLElementNode, String) -> Herb::AST::HTMLAttributeNode?
      def find_attribute(element, name)
        element.open_tag.children.find do |child|
          next false unless child.is_a?(HTMLAttributeNode)
          next false unless child.name&.children&.first

          child.name.children.first.content == name
        end
      end

      #: (Herb::AST::HTMLElementNode, String, String) -> void
      def set_attribute(element, name, value)
        existing = find_attribute(element, name)

        if existing
          if existing.value&.children&.first
            existing.value.children.first.content = value.to_s.dup
          end
        else
          add_attribute(element, name, value)
        end
      end

      #: (Herb::AST::HTMLElementNode, String) -> String?
      def attribute_value(element, name)
        attribute = find_attribute(element, name)
        value = attribute&.value

        return nil unless value&.children&.first

        attribute.value.children.first.content
      end

      #: (Herb::AST::HTMLElementNode, String, String) -> void
      def add_token(element, attribute_name, token)
        existing = attribute_value(element, attribute_name)

        if existing
          tokens = existing.split
          return if tokens.include?(token)

          set_attribute(element, attribute_name, "#{existing} #{token}")
        else
          add_attribute(element, attribute_name, token)
        end
      end

      #: (Herb::AST::HTMLElementNode, String, String) -> void
      def remove_token(element, attribute_name, token)
        existing = attribute_value(element, attribute_name)
        return unless existing

        tokens = existing.split.reject { |t| t == token }

        if tokens.empty?
          remove_attribute(element, attribute_name)
        else
          set_attribute(element, attribute_name, tokens.join(" "))
        end
      end

      #: (Herb::AST::HTMLElementNode, String, String, String) -> void
      def replace_token(element, attribute_name, old_token, new_token)
        existing = attribute_value(element, attribute_name)
        return unless existing

        tokens = existing.split.map { |t| t == old_token ? new_token : t }
        set_attribute(element, attribute_name, tokens.join(" "))
      end

      #: (Herb::AST::HTMLElementNode, String, String) -> bool
      def includes_token?(element, attribute_name, token)
        existing = attribute_value(element, attribute_name)
        return false unless existing

        existing.split.include?(token)
      end

      #: (Herb::AST::HTMLElementNode, String) -> void
      def add_class(element, class_name)
        add_token(element, "class", class_name)
      end

      #: (Herb::AST::HTMLElementNode, String) -> void
      def remove_class(element, class_name)
        remove_token(element, "class", class_name)
      end

      #: (Herb::AST::HTMLElementNode, String, String) -> void
      def replace_class(element, old_class, new_class)
        replace_token(element, "class", old_class, new_class)
      end

      #: (Herb::AST::HTMLElementNode, String) -> bool
      def includes_class?(element, class_name)
        includes_token?(element, "class", class_name)
      end
    end
  end
end
