# frozen_string_literal: true

module Herb
  class Engine
    # Semantic HTML Validator
    #
    # This validator focuses on semantic HTML validation such as:
    # - Invalid HTML nesting (e.g., <p> containing block elements)
    # - Accessibility issues (e.g., nested anchors)
    # - Deprecated HTML attributes
    #
    # Syntax validation (missing ends, unclosed tags, Ruby syntax errors)
    # is handled by the parser and should not be duplicated here.
    class Validator < ::Herb::Visitor
      attr_reader :errors

      def initialize#
        @errors = []
      end

      def visit_html_element_node(node)
        validate_html_nesting(node)
        super
      end

      def visit_html_attribute_node(node)
        validate_attribute(node)
        super
      end

      private

      def validate_html_nesting(node)
        tag_name = node.tag_name&.value&.downcase
        return unless tag_name

        case tag_name
        when "p"
          validate_no_block_elements_in_paragraph(node)
        when "a"
          validate_no_nested_anchors(node)
        when "button"
          validate_no_interactive_in_button(node)
        end
      end

      def validate_no_block_elements_in_paragraph(node)
        block_elements = %w[div section article header footer nav aside p h1 h2 h3 h4 h5 h6 ul ol dl table form]

        node.body.each do |child|
          next unless child.is_a?(Herb::AST::HTMLElementNode)

          child_tag = child.tag_name&.value&.downcase
          next unless block_elements.include?(child_tag)

          add_error(
            "InvalidNestingError",
            child.location,
            "Block element <#{child_tag}> cannot be nested inside <p> at line #{child.location.start.line}"
          )
        end
      end

      def validate_no_nested_anchors(node)
        find_nested_elements(node, "a") do |nested|
          add_error(
            "NestedAnchorError",
            nested.location,
            "Anchor <a> cannot be nested inside another anchor at line #{nested.location.start.line}"
          )
        end
      end

      def validate_no_interactive_in_button(node)
        interactive_elements = %w[a button input select textarea]

        node.body.each do |child|
          next unless child.is_a?(Herb::AST::HTMLElementNode)

          child_tag = child.tag_name&.value&.downcase
          next unless interactive_elements.include?(child_tag)

          add_error(
            "InvalidNestingError",
            child.location,
            "Interactive element <#{child_tag}> cannot be nested inside <button> at line #{child.location.start.line}"
          )
        end
      end

      def validate_attribute(node)
      end

      def validate_id_format(node)
      end

      def find_nested_elements(node, tag_name, &block)
        node.body.each do |child|
          if child.is_a?(Herb::AST::HTMLElementNode)
            if child.tag_name&.value&.downcase == tag_name
              yield child
            else
              find_nested_elements(child, tag_name, &block)
            end
          end
        end
      end

      def extract_text_value(value_node)
        return nil unless value_node

        text = String.new
        value_node.children.each do |child|
          case child
          when Herb::AST::LiteralNode
            text << child.content
          when Herb::AST::HTMLTextNode
            text << child.content
          end
        end
        text
      end

      def add_error(type, location, message)
        @errors << ValidationError.new(type, location, message)
      end

      class ValidationError
        attr_reader :type, :location, :message

        def initialize(type, location, message)
          @type = type
          @location = location
          @message = message
        end
        # 
        # def class
        #   OpenStruct.new(name: "Herb::Engine::Validator::#{type}")
        # end
      end
    end
  end
end
