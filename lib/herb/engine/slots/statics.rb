# frozen_string_literal: true
# typed: true

require_relative "annotation"

module Herb
  class Engine
    module Slots
      # Prints the markup a branch would render, with everything dynamic left out.
      #
      # It runs over a branch body after `Visitor` has marked it, so what comes out is the
      # branch's static HTML with an empty marker pair everywhere a slot would go. That is what a
      # client needs to build the branch itself: the parts that never change, and the positions of
      # the parts that do.
      #
      # A node that is itself a slot prints as nothing, because its markers were inserted around
      # it and stay. A conditional nested inside a branch is a slot, so it prints as its empty pair
      # and parks its own branches separately, rather than having all of its alternatives written
      # out inside its parent's.
      #
      # Anything it does not recognise raises. Parking nothing for a branch leaves it server
      # rendered, which is correct but slower. Parking markup that is missing a piece would render
      # the branch wrong, which is not recoverable.
      #
      class Statics
        class Unprintable < StandardError
        end

        SKIPPED_PREFIXES = ["AST_ERB_", "AST_RUBY_"].freeze #: Array[String]

        #: (Hash[untyped, Annotation], ?Hash[untyped, Array[Annotation]]) -> void
        def initialize(standing, anchored = {})
          @standing = standing
          @anchored = anchored
          @out = +"" #: String
          @signature = false
          @found = [] #: Array[Annotation]
        end

        #: (Array[untyped]) -> String?
        def markup(nodes)
          @signature = false

          run(nodes)
        end

        #: (Array[untyped]) -> [String, Array[Annotation]]?
        def signature(nodes)
          @signature = true

          shape = run(nodes)

          shape ? [shape, @found] : nil
        end

        private

        #: (Array[untyped]) -> String?
        def run(nodes)
          @out = +""
          @found = [] #: Array[Annotation]

          write_all(nodes)

          @out
        rescue Unprintable
          nil
        end

        #: (untyped) -> void
        def write(node)
          standing = @standing[node]

          return write_placeholder(standing) if standing

          return if SKIPPED_PREFIXES.any? { |prefix| node.type.to_s.start_with?(prefix) }

          case node
          when Herb::AST::HTMLTextNode, Herb::AST::LiteralNode
            emit(node.content)
          when Herb::AST::WhitespaceNode
            separate(node.value&.value)
          when Herb::AST::HTMLElementNode
            write(node.open_tag)
            write_all(node.body)
            write(node.close_tag) if node.close_tag
          when Herb::AST::HTMLOpenTagNode
            emit(node.tag_opening&.value || "<")
            emit(node.tag_name&.value)

            @anchored[node]&.each { |annotation| write_placeholder(annotation) }

            write_all(node.children)
            emit(node.tag_closing&.value || ">")
          when Herb::AST::HTMLCloseTagNode
            emit(node.tag_opening&.value)
            emit(node.tag_name&.value)
            emit(node.tag_closing&.value)
          when Herb::AST::HTMLVirtualCloseTagNode
            emit("</#{node.tag_name.value}>") if node.tag_name
          when Herb::AST::HTMLOmittedCloseTagNode
            nil
          when Herb::AST::HTMLAttributeNode
            write_attribute(node)
          when Herb::AST::HTMLAttributeNameNode
            write_all(node.children)
          when Herb::AST::HTMLAttributeValueNode
            write_attribute_value(node)
          when Herb::AST::HTMLCommentNode
            write_wrapped(node.comment_start, node.children, node.comment_end)
          when Herb::AST::HTMLDoctypeNode, Herb::AST::XMLDeclarationNode, Herb::AST::CDATANode
            write_wrapped(node.tag_opening, node.children, node.tag_closing)
          else
            raise Unprintable
          end
        end

        #: (Annotation) -> void
        def write_placeholder(annotation)
          return unless @signature

          @found << annotation

          emit("\u0000#{annotation.type}\u0000")
        end

        #: (untyped) -> void
        def write_all(nodes)
          return unless nodes.is_a?(Array)

          nodes.each { |node| write(node) }
        end

        #: (untyped, untyped, untyped) -> void
        def write_wrapped(opening, children, closing)
          emit(opening&.value)
          write_all(children)
          emit(closing&.value)
        end

        #: (untyped) -> void
        def write_attribute(node)
          separate(" ")
          write(node.name)

          return unless node.value

          emit(node.equals&.value&.include?("=") ? node.equals.value : "=")
          write(node.value)
        end

        #: (untyped) -> void
        def write_attribute_value(node)
          return write_all(node.children) unless node.quoted

          emit(node.open_quote&.value || '"')
          write_all(node.children)
          emit(node.close_quote&.value || '"')
        end

        #: (untyped) -> void
        def emit(text)
          @out << text.to_s
        end

        #: (untyped) -> void
        def separate(text)
          return if @out.empty? || @out.end_with?(" ", "\t", "\n", "\r")

          @out << text.to_s
        end
      end
    end
  end
end
