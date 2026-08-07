# frozen_string_literal: true
# typed: true

require "digest"

require_relative "slot_markers"

module Herb
  class Engine
    class SlotVisitor < Herb::Visitor
      ATTRIBUTE_TYPES = [:attribute, :attribute_interpolation].freeze #: Array[Symbol]
      ELEMENT_ANCHORED_TYPES = [*ATTRIBUTE_TYPES, :boolean_attribute, :element, :raw_text].freeze #: Array[Symbol]
      BRANCH_BODY_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]
      BRANCH_CONTINUATION_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

      attr_reader :slots #: Array[Slot]
      attr_reader :warnings #: Array[Herb::Warnings::Warning]

      Slot = Data.define(
        :index,      #: Integer
        :type,       #: Symbol
        :node_path,  #: Array[Integer]
        :expression, #: String?
        :location,   #: String?
        :attribute,  #: String?
        :key_source, #: Symbol?
        :key_expression #: String?
      )

      #: (?file_path: untyped, ?project_path: untyped, ?markers: SlotMarkers) -> void
      def initialize(file_path: nil, project_path: nil, markers: SlotMarkers.new)
        super()

        @markers = markers
        @relative_file_path = relative_path_for(file_path, project_path)

        @slots = [] #: Array[Slot]
        @warnings = [] #: Array[Herb::Warnings::Warning]
        @path = [] #: Array[Integer]

        pending = {} #: Hash[untyped, Integer]
        element_anchored = {} #: Hash[untyped, Array[Integer]]
        continuations = {} #: Hash[untyped, bool]

        @pending = pending.compare_by_identity
        @element_anchored = element_anchored.compare_by_identity
        @continuations = continuations.compare_by_identity

        @in_attribute = false
        @in_open_tag = false
        @in_html_comment = false
        @in_html_doctype = false
        @raw_text_depth = 0
        @rcdata_depth = 0
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
          slots: @slots.map { |slot|
            entry = { index: slot.index, type: slot.type, node_path: slot.node_path }
            entry = entry.merge(attribute: slot.attribute) if slot.attribute
            entry = entry.merge(key_source: slot.key_source) if slot.key_source
            entry
          },
        }
      end

      def visit_document_node(node)
        visit_children_with_paths(node.children)

        insert_markers(node)
        wrap_region(node)
      end

      def visit_html_element_node(node)
        tag_name = node.tag_name&.value&.downcase.to_s
        raw_text = Herb::HTML::Util.raw_text_element?(tag_name)
        rcdata = Herb::HTML::Util.rcdata_element?(tag_name)

        @raw_text_depth += 1 if raw_text
        @rcdata_depth += 1 if rcdata

        previous_open_tag = @current_open_tag
        @current_open_tag = node.open_tag

        visit(node.open_tag) if node.open_tag
        visit_children_with_paths(node.body)
        visit(node.close_tag) if node.close_tag

        @current_open_tag = previous_open_tag

        @rcdata_depth -= 1 if rcdata
        @raw_text_depth -= 1 if raw_text
      end

      def visit_html_open_tag_node(node)
        @in_open_tag = true
        super
        @in_open_tag = false
      end

      def visit_html_attribute_node(node)
        record_slot(node, attribute_type_for(node)) if dynamic?(node)

        @in_attribute = true
        super
        @in_attribute = false
      end

      def visit_html_comment_node(node)
        record_slot(node, :comment) if dynamic?(node)

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

      def visit_erb_while_node(node)
        record_slot(node, :collection)

        visit_branching_node(node)
      end

      def visit_erb_until_node(node)
        record_slot(node, :collection)

        visit_branching_node(node)
      end

      def visit_erb_for_node(node)
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

        type = anchored_type_for(type)

        return unless type
        return if @in_html_comment || @in_html_doctype

        key_source, key_expression = type == :collection ? key_for(node) : [nil, nil]

        slot = Slot.new(
          index: @slots.size,
          type: type,
          node_path: @path.dup,
          expression: expression_for(node),
          location: location_for(node),
          attribute: attribute_name_for(node),
          key_source: key_source,
          key_expression: key_expression
        )

        @slots << slot

        if type == :collection && key_source == :index
          @warnings << Herb::Warnings::UnkeyedCollectionWarning.new(
            node.location,
            expression_for(node),
            tag_name: keyable_tag_name_for(node)
          )
        end

        if !ELEMENT_ANCHORED_TYPES.include?(type)
          @pending[node] = slot.index
        elsif @current_open_tag
          anchored = @element_anchored[@current_open_tag] || [] #: Array[Integer]
          anchored << slot.index

          @element_anchored[@current_open_tag] = anchored
        end
      end

      #: (Symbol) -> Symbol?
      def anchored_type_for(type)
        return type if ATTRIBUTE_TYPES.include?(type)

        return nil if @in_attribute
        return :element if @in_open_tag
        return nil if @raw_text_depth.positive?
        return :raw_text if @rcdata_depth.positive?

        type
      end

      #: (untyped) -> Symbol
      def attribute_type_for(node)
        children = node.value&.children || []

        children.one? ? :attribute : :attribute_interpolation
      end

      #: (untyped) -> [Symbol, String?]
      def key_for(node)
        body = collection_body(node)

        directive = key_directive_in(body)
        return [:directive, directive] if directive

        elements = body.grep(Herb::AST::HTMLElementNode)
        return [:index, nil] unless elements.one?

        attributes = attributes_for(elements.first)

        ["herb-key", "id"].each do |name|
          attribute = attributes.find { |candidate| attribute_name_for(candidate)&.downcase == name }
          next unless attribute

          expression = key_expression_for(attribute)
          next unless expression

          return [name == "herb-key" ? :herb_key : :id, expression]
        end

        [:index, nil]
      end

      #: (untyped) -> String?
      def keyable_tag_name_for(node)
        elements = collection_body(node).grep(Herb::AST::HTMLElementNode)
        return nil unless elements.one?

        elements.first.tag_name&.value&.downcase
      end

      #: (Array[untyped]) -> String?
      def key_directive_in(body)
        body.each do |child|
          next unless child.is_a?(Herb::AST::ERBContentNode)
          next unless child.tag_opening&.value == "<%#"

          match = child.content&.value.to_s.strip.match(/\Aherb:key\s+(?<expression>.+)\z/)
          return match[:expression].strip if match
        end

        nil
      end

      #: (untyped) -> String?
      def key_expression_for(attribute)
        children = attribute.value&.children || []
        return nil unless children.one?

        erb = children.first
        return nil unless erb.type.to_s == "AST_ERB_CONTENT_NODE"

        erb.content&.value&.strip
      end

      #: (untyped) -> Array[untyped]
      def collection_body(node)
        BRANCH_BODY_PROPERTIES.filter_map { |property|
          node.send(property) if node.respond_to?(property)
        }.flatten
      end

      #: (untyped) -> Array[untyped]
      def attributes_for(element)
        open_tag = element.open_tag
        return [] unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

        open_tag.children.grep(Herb::AST::HTMLAttributeNode)
      end

      #: (untyped) -> String?
      def attribute_name_for(node)
        return nil unless node.is_a?(Herb::AST::HTMLAttributeNode)

        node.name&.children&.filter_map { |child| child.content if child.respond_to?(:content) }&.join
      end

      #: (untyped) -> bool
      def dynamic?(node)
        return true if node.type.to_s.start_with?("AST_ERB_")

        node.compact_child_nodes.any? { |child| dynamic?(child) }
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
            wrap_rows(child, slot_index)
            mark_branches(child, slot_index)

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

      #: (untyped, Integer?) -> void
      def mark_branches(node, slot_index)
        return unless slot_index
        return unless @slots[slot_index].type == :conditional

        branch_bodies(node).each_with_index do |body, branch_index|
          body.unshift(text_node(@markers.branch(slot_index, branch_index)))
        end
      end

      #: (untyped) -> Array[Array[untyped]]
      def branch_bodies(node)
        bodies = [] #: Array[Array[untyped]]

        if node.respond_to?(:conditions)
          node.conditions.each { |arm| bodies << arm.statements if arm.respond_to?(:statements) }
        elsif node.respond_to?(:statements)
          bodies << node.statements
        end

        current = continuation_of(node) #: untyped

        while (branch = current)
          bodies << branch.statements if branch.respond_to?(:statements)

          current = continuation_of(branch)
        end

        bodies
      end

      #: (untyped) -> untyped
      def continuation_of(node)
        subsequent = node.respond_to?(:subsequent) ? node.subsequent : nil

        subsequent || (node.respond_to?(:else_clause) ? node.else_clause : nil)
      end

      #: (untyped, Integer?) -> void
      def wrap_rows(node, slot_index)
        return unless slot_index

        slot = @slots[slot_index]
        return unless slot.type == :collection && slot.key_expression

        BRANCH_BODY_PROPERTIES.each do |property|
          next unless node.respond_to?(property)

          body = node.send(property)
          next unless body.is_a?(Array) && !body.empty?

          body.unshift(
            text_node(@markers.row_open_prefix(slot_index)),
            erb_output_node(slot.key_expression),
            text_node(@markers.row_open_suffix)
          )

          body.push(text_node(@markers.row_close(slot_index)))
        end
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

      def text_node(content)
        Herb::AST::HTMLTextNode.new("HTMLTextNode", Herb::Location.zero, [], content.dup)
      end

      def erb_output_node(code)
        Herb::AST::ERBContentNode.new(
          "ERBContentNode", Herb::Location.zero, [],
          token(:erb_start, "<%="), token(:erb_content, " #{code} "), token(:erb_end, "%>"),
          nil, false, true,
          nil # steep:ignore
        )
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
