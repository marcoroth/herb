# frozen_string_literal: true
# typed: false

# rbs_inline: disabled

require_relative "../validator"

module Herb
  class Engine
    module Validators
      class NestingValidator < Validator
        def visit_html_element_node(node)
          validate_html_nesting(node)
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
            next unless child_tag && block_elements.include?(child_tag)

            add_validation_error(
              "InvalidNestingError",
              child.location,
              "Block element <#{child_tag}> cannot be nested inside <p> at line #{child.location.start.line}"
            )
          end
        end

        def validate_no_nested_anchors(node)
          find_nested_elements(node, "a") do |nested|
            add_validation_error(
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
            next unless child_tag && interactive_elements.include?(child_tag)

            add_validation_error(
              "InvalidNestingError",
              child.location,
              "Interactive element <#{child_tag}> cannot be nested inside <button> at line #{child.location.start.line}"
            )
          end
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

        def add_validation_error(type, location, message)
          error(message, location, code: type, source: "NestingValidator")
        end
      end
    end
  end
end
