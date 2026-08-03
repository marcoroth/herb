# frozen_string_literal: true
# typed: true

require "digest"

require_relative "slot_markers"

module Herb
  class Engine
    class SlotVisitor < Herb::Visitor
      ELEMENT_ANCHORED_TYPES = [:attribute, :attribute_interpolation, :boolean_attribute, :element].freeze #: Array[Symbol]
      BRANCH_BODY_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]
      BRANCH_CONTINUATION_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

      attr_reader :slots #: Array[Slot]

      Slot = Data.define(
        :index,      #: Integer
        :type,       #: Symbol
        :node_path,  #: Array[Integer]
        :expression, #: String?
        :location    #: String?
      )

      #: (?file_path: untyped, ?project_path: untyped, ?markers: SlotMarkers) -> void
      def initialize(file_path: nil, project_path: nil, markers: SlotMarkers.new)
        super()

        @markers = markers
        @relative_file_path = relative_path_for(file_path, project_path)

        @slots = [] #: Array[Slot]
        @path = [] #: Array[Integer]

        pending = {} #: Hash[untyped, Integer]
        element_anchored = {} #: Hash[untyped, Array[Integer]]
        continuations = {} #: Hash[untyped, bool]

        @pending = pending.compare_by_identity
        @element_anchored = element_anchored.compare_by_identity
        @continuations = continuations.compare_by_identity

        @in_attribute = false
        @in_html_comment = false
        @in_html_doctype = false
        @raw_text_depth = 0
        @current_open_tag = nil
      end

      #: () -> String
      def version
        @version ||= Digest::SHA256.hexdigest(
          @slots.map { |slot| "#{slot.index}:#{slot.type}" }.join(",")
        ).slice(0, 8).to_s
      end

      #: () -> Hash[Symbol, untyped]
      def schema
        {
          file: @relative_file_path,
          version: version,
          slots: @slots.map { |slot| { index: slot.index, type: slot.type, node_path: slot.node_path } },
        }
      end

      def visit_document_node(node)
        visit_children_with_paths(node.children)

        insert_markers(node)
        wrap_region(node)
      end

      def visit_html_element_node(node)
        raw_text = raw_text_element?(node)
        @raw_text_depth += 1 if raw_text

        previous_open_tag = @current_open_tag
        @current_open_tag = node.open_tag

        visit(node.open_tag) if node.open_tag
        visit_children_with_paths(node.body)
        visit(node.close_tag) if node.close_tag

        @current_open_tag = previous_open_tag
        @raw_text_depth -= 1 if raw_text
      end

      def visit_html_attribute_node(node)
        @in_attribute = true
        super
        @in_attribute = false
      end

      def visit_html_comment_node(node)
        @in_html_comment = true
        super
        @in_html_comment = false
      end

      def visit_html_doctype_node(node)
        @in_html_doctype = true
        super
        @in_html_doctype = false
      end

      def visit_erb_content_node(node)
        record_slot(node, erb_output?(node.tag_opening&.value.to_s) ? :child : nil)

        super
      end

      def visit_erb_yield_node(node)
        record_slot(node, :child)

        super
      end

      def visit_erb_if_node(node)
        record_slot(node, :conditional) unless continuation?(node)

        visit_branching_node(node)
      end

      def visit_erb_unless_node(node)
        record_slot(node, :conditional) unless continuation?(node)

        visit_branching_node(node)
      end

      def visit_erb_case_node(node)
        record_slot(node, :conditional) unless continuation?(node)

        visit_branching_node(node)
      end

      def visit_erb_block_node(node)
        record_slot(node, :block)

        visit_branching_node(node)
      end

      def visit_erb_iteration_block_node(node)
        record_slot(node, :collection)

        visit_branching_node(node)
      end

      private

      #: (untyped, untyped) -> String
      def relative_path_for(file_path, project_path)
        return "unknown" unless file_path

        filename = file_path.is_a?(::Pathname) ? file_path : ::Pathname.new(file_path.to_s)
        return filename.to_s unless filename.absolute?

        root = project_path ? ::Pathname.new(project_path.to_s) : ::Pathname.new(Dir.pwd)
        filename.relative_path_from(root).to_s
      rescue ArgumentError
        file_path.to_s
      end

      def visit_children_with_paths(children)
        return unless children.is_a?(Array)

        children.each_with_index do |child, index|
          @path.push(index)
          visit(child)
          @path.pop
        end
      end

      def visit_branching_node(node)
        BRANCH_BODY_PROPERTIES.each do |property|
          next unless node.respond_to?(property)

          visit_children_with_paths(node.send(property))
        end

        BRANCH_CONTINUATION_PROPERTIES.each do |property|
          next unless node.respond_to?(property)

          child = node.send(property)
          next unless child

          @continuations[child] = true
          visit(child)
        end
      end

      #: (untyped) -> bool
      def continuation?(node)
        @continuations.key?(node)
      end

      #: (untyped, Symbol?) -> void
      def record_slot(node, type)
        return unless type

        type = attribute_slot_type(type) if @in_attribute

        return unless type
        return if @in_html_comment || @in_html_doctype
        return if @raw_text_depth.positive? && !@in_attribute

        slot = Slot.new(
          index: @slots.size,
          type: type,
          node_path: @path.dup,
          expression: expression_for(node),
          location: location_for(node)
        )

        @slots << slot

        if !ELEMENT_ANCHORED_TYPES.include?(type)
          @pending[node] = slot.index
        elsif @current_open_tag
          anchored = @element_anchored[@current_open_tag] || [] #: Array[Integer]
          anchored << slot.index

          @element_anchored[@current_open_tag] = anchored
        end
      end

      #: (Symbol) -> Symbol?
      def attribute_slot_type(_type)
        :attribute
      end

      def expression_for(node)
        return nil unless node.respond_to?(:content)

        content = node.content
        value = content.respond_to?(:value) ? content.value : content

        value&.to_s&.strip
      end

      def location_for(node)
        location = node.location
        return nil unless location

        "#{location.start.line}:#{location.start.column}"
      end

      def raw_text_element?(node)
        ["script", "style"].include?(node.tag_name&.value&.downcase.to_s)
      end

      def erb_output?(opening)
        opening.include?("=")
      end

      def insert_markers(node)
        each_child_array(node) do |array|
          index = 0

          while index < array.size
            child = array[index]
            slot_index = @pending[child]

            insert_markers(child)

            if slot_index
              array.insert(index, comment_node(@markers.slot_open(slot_index, @slots[slot_index].type)))
              array.insert(index + 2, comment_node(@markers.slot_close(slot_index)))

              index += 3
            else
              index += 1
            end
          end
        end

        anchor_attributes(node)
      end

      def anchor_attributes(node)
        return unless node.is_a?(Herb::AST::HTMLElementNode)

        open_tag = node.open_tag
        return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

        indices = @element_anchored[open_tag]
        return if indices.nil? || indices.empty?

        open_tag.children << attribute_node("data-herb-slot", indices.join(","))
      end

      #: (untyped) { (Array[untyped]) -> void } -> void
      def each_child_array(node)
        BRANCH_BODY_PROPERTIES.each do |property|
          next unless node.respond_to?(property)

          array = node.send(property)
          yield array if array.is_a?(Array)
        end

        (BRANCH_CONTINUATION_PROPERTIES + [:end_node, :open_tag]).each do |property|
          next unless node.respond_to?(property)

          child = node.send(property)
          insert_markers(child) if child
        end
      end

      def wrap_region(document_node)
        document_node.children.unshift(comment_node(@markers.region_open(@relative_file_path, version)))

        document_node.children.push(comment_node(@markers.region_close(@relative_file_path)))
      end

      def comment_node(text)
        Herb::AST::HTMLCommentNode.new(
          "HTMLCommentNode",
          Herb::Location.zero,
          [],
          token(:html_comment_start, text),
          [],
          token(:html_comment_end, "")
        )
      end

      def attribute_node(name, value)
        name_node = Herb::AST::HTMLAttributeNameNode.new(
          "HTMLAttributeNameNode", Herb::Location.zero, [], [literal(name)]
        )

        value_node = Herb::AST::HTMLAttributeValueNode.new(
          "HTMLAttributeValueNode", Herb::Location.zero, [], token(:quote, '"'), [literal(value)], token(:quote, '"'), true
        )

        Herb::AST::HTMLAttributeNode.new(
          "HTMLAttributeNode", Herb::Location.zero, [], name_node, token(:equals, "="), value_node
        )
      end

      def literal(content)
        Herb::AST::LiteralNode.new("LiteralNode", Herb::Location.zero, [], content.dup)
      end

      def token(type, value)
        Herb::Token.new(value.dup, Herb::Range.zero, Herb::Location.zero, type.to_s)
      end
    end
  end
end
