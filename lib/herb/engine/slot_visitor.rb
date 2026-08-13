# frozen_string_literal: true
# typed: true

require "digest"

require_relative "../visitor"
require_relative "context_aware"
require_relative "slot_markers"
require_relative "slot_statics"

module Herb
  class Engine
    # Records where a template's dynamic content ends up, and marks those places in the output so
    # something outside Ruby can find them again:
    #
    #     visitor = Herb::Engine::SlotVisitor.new
    #
    #     Herb::Engine.new(source, visitors: [visitor], filename: "app/views/posts/index.html.erb")
    #
    #     visitor.slots
    #
    # Templates can also ask for this themselves with a `<%# herb:slots %>` directive, and say who
    # renders their branches with `<%# herb:slots client %>`. Deciding what that means belongs to
    # whoever builds the stack, so the directive is only read here:
    #
    #     mode = Herb::Engine::SlotVisitor.directive_mode(source)
    #     visitors = mode ? [Herb::Engine::SlotVisitor.new(mode: mode)] : []
    #
    class SlotVisitor < Herb::Visitor
      include ContextAware

      recommended_parser_option iteration_nodes: true

      attr_reader :slots #: Array[Slot]
      attr_reader :warnings #: Array[Herb::Warnings::Warning]

      SLOTS_DIRECTIVE = /<%#-?\s*herb:slots\b(?<mode>[^%]*?)-?%>/ #: Regexp
      MODE_OPTION = /\b(server|client)\b/ #: Regexp
      MODES = [:server, :client].freeze #: Array[Symbol]
      COVERED = "_herb_covered_branches" #: String
      BRANCHING_TYPES = [:conditional, :collection, :block].freeze #: Array[Symbol]

      ATTRIBUTE_TYPES = [:attribute, :attribute_interpolation].freeze #: Array[Symbol]
      ELEMENT_ANCHORED_TYPES = [*ATTRIBUTE_TYPES, :boolean_attribute, :element, :raw_text].freeze #: Array[Symbol]
      BRANCH_BODY_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]
      BRANCH_CONTINUATION_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

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

      #: (String) -> bool
      def self.directive?(source)
        SLOTS_DIRECTIVE.match?(source)
      end

      # Who renders a branch of this template, which is the one thing a template has to say and
      # the one thing that cannot be decided for it.
      #
      #     <%# herb:slots server %>   the server renders a branch and sends the markup
      #     <%# herb:slots client %>   the client is sent every branch and renders them itself
      #
      # Saying neither means `server`. Being sent a branch that did not render is being sent
      # something the request did not ask for, so it is asked for rather than assumed.
      #
      # Both are slot aware. The directive is `herb:slots`, so the client is told where this
      # template's dynamic parts are either way, and these two only say who fills them.
      #: (String) -> Symbol?
      def self.directive_mode(source)
        match = SLOTS_DIRECTIVE.match(source)

        return nil unless match

        named = MODE_OPTION.match(match[:mode])

        named ? named[1].to_sym : :server
      end

      #: () -> bool
      def self.reads_erb_source?
        true
      end

      #: (?markers: SlotMarkers, ?mode: Symbol, ?identifier: (Symbol | ^(String) -> String)) -> void
      def initialize(markers: SlotMarkers.new, mode: :server, identifier: :path)
        super()

        raise ArgumentError, "unknown slot mode #{mode.inspect}, expected one of #{MODES.inspect}" unless MODES.include?(mode)

        @markers = markers
        @mode = mode
        @statics = mode == :client ? {} : nil #: Hash[String, String]?
        @identify = identifier

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
        @version ||= Digest::SHA256.hexdigest(slot_entries.map(&:inspect).join(",")).slice(0, 8).to_s
      end

      def inspect
        parts = [self.class.name, @mode.to_s] #: Array[String]

        parts << "#{@identify} ids" unless @identify == :path

        "#<#{parts.join(" ")}>"
      end

      #: () -> String
      def identifier
        @identifier ||= case @identify
                        when :path then context.relative_file_path
                        when :digest then Digest::SHA256.hexdigest(context.relative_file_path).slice(0, 12).to_s
                        else @identify.call(context.relative_file_path)
                        end
      end

      #: () -> Hash[Symbol, untyped]
      def schema
        {
          file: context.relative_file_path,
          identifier: identifier,
          version: version,
          slots: slot_entries,
        }
      end

      #: () -> Array[Hash[Symbol, untyped]]
      def slot_entries
        @slot_entries ||= @slots.map { |slot|
          entry = { index: slot.index, type: slot.type, node_path: slot.node_path }
          entry = entry.merge(attribute: slot.attribute) if slot.attribute
          entry = entry.merge(key_source: slot.key_source) if slot.key_source
          entry
        }
      end

      def visit_document_node(node)
        visit_children_with_paths(node.children)

        collapse_invariant_conditionals
        insert_markers(node)
        wrap_region(node)
        append_statics(node)
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

      #: () -> void
      def collapse_invariant_conditionals
        merged = {} #: Hash[Integer, Integer]
        dropped = {} #: Hash[Integer, bool]

        @pending.each do |node, index|
          next unless @slots[index].type == :conditional
          next unless exhaustive?(node)

          bodies = branch_bodies(node)
          next unless bodies.size > 1

          signatures = bodies.filter_map { |body| SlotStatics.new(@pending, @slots, @element_anchored).signature(body) }
          next unless signatures.size == bodies.size

          shapes = signatures.map { |shape, _| shape }
          next unless shapes.uniq.one?
          next if branching_shape?(shapes.fetch(0))

          positions = signatures.map { |_, indices| indices }
          shared = positions.fetch(0)

          dropped[index] = true

          positions.drop(1).each do |indices|
            indices.each_with_index { |old, position| merged[old] = shared.fetch(position) }
          end
        end

        renumber(merged, dropped) unless dropped.empty?
      end

      #: (untyped) -> bool
      def exhaustive?(node)
        last = nil #: untyped
        current = continuation_of(node) #: untyped

        while current
          last = current
          current = continuation_of(current)
        end

        last.is_a?(Herb::AST::ERBElseNode)
      end

      #: (String) -> bool
      def branching_shape?(shape)
        BRANCHING_TYPES.any? { |type| shape.include?("\u0000#{type}\u0000") }
      end

      #: (Hash[Integer, Integer], Hash[Integer, bool]) -> void
      def renumber(merged, dropped)
        survivors = (0...@slots.size).reject { |index| dropped[index] || merged.key?(index) }
        moved = survivors.each_with_index.to_h #: Hash[Integer, Integer]
        resolve = ->(index) { moved.fetch(merged.fetch(index, index)) }

        @slots = survivors.each_with_index.map { |old, index| @slots[old].with(index: index) }

        renumbered = {} #: Hash[untyped, Integer]
        pending = renumbered.compare_by_identity

        @pending.each do |node, index|
          pending[node] = resolve.call(index) unless dropped[index]
        end

        @pending = pending

        @element_anchored.each do |open_tag, indices|
          @element_anchored[open_tag] = indices.map { |index| resolve.call(index) }
        end
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
        return :element unless attribute_name_for(node)

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
        parts = key_parts_for(attribute)
        return nil if parts.nil?
        return nil unless parts.any? { |kind, _| kind == :expression }
        return parts.first[1] if parts.one?

        interpolated = parts.map { |kind, value|
          kind == :expression ? "\#{#{value}}" : escape_key_literal(value)
        }

        %("#{interpolated.join}")
      end

      #: (untyped) -> Array[[Symbol, String]]?
      def key_parts_for(attribute)
        children = attribute.value&.children || []
        return nil if children.empty?

        children.map { |child|
          case child
          when Herb::AST::ERBContentNode
            expression = child.content&.value.to_s.strip
            return nil if expression.empty?

            [:expression, expression]
          when Herb::AST::LiteralNode
            [:literal, child.content.to_s]
          else
            return nil
          end
        }
      end

      #: (String) -> String
      def escape_key_literal(literal)
        literal.gsub(/["\\]|\#\{/) { |match| "\\#{match}" }
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

        children = node.name&.children || []

        return nil if children.empty?
        return nil unless children.all?(Herb::AST::LiteralNode)

        children.filter_map { |child| child.content if child.respond_to?(:content) }.join
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
        anchored = child_anchor_index(node)

        each_child_array(node) do |array|
          index = 0

          while index < array.size
            child = array[index]
            slot_index = @pending[child]

            insert_markers(child)
            wrap_rows(child, slot_index)
            mark_branches(child, slot_index)

            if slot_index && slot_index != anchored
              array.insert(index, comment_node(@markers.slot_open(slot_index, @slots[slot_index].type)))
              array.insert(index + 2, comment_node(@markers.slot_close(slot_index)))

              index += 3
            else
              index += 1
            end
          end
        end

        anchor_attributes(node)
        anchor_child(node, anchored)
      end

      #: (untyped) -> Integer?
      def child_anchor_index(node)
        return nil unless node.is_a?(Herb::AST::HTMLElementNode)

        body = node.body
        return nil unless body.is_a?(Array) && body.size == 1

        slot_index = @pending[body[0]]
        return nil unless slot_index
        return nil unless @slots[slot_index].type == :child

        slot_index
      end

      #: (untyped, Integer?) -> void
      def anchor_child(node, slot_index)
        return unless slot_index

        open_tag = node.open_tag
        return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

        open_tag.children << attribute_node("data-herb-child", @markers.child_anchor(slot_index))
      end

      #: (untyped, Integer?) -> void
      def mark_branches(node, slot_index)
        return unless slot_index
        return unless @slots[slot_index].type == :conditional

        branch_bodies(node).each_with_index do |body, branch_index|
          body.unshift(text_node(@markers.branch(slot_index, branch_index)))

          park_branch("#{slot_index}:#{branch_index}", body)
        end
      end

      #: (String, Array[untyped]) -> void
      def park_branch(key, body)
        statics = @statics
        return unless statics

        markup = SlotStatics.new(@pending).markup(body)
        return unless markup

        statics[key] = markup

        body.insert(1, erb_code_node(%(#{COVERED}["#{key}"] = true)))
      end

      #: (untyped) -> void
      def append_statics(document_node)
        statics = @statics
        return if statics.nil? || statics.empty?

        branches = statics.sort_by { |key, _| key.split(":").map(&:to_i) }

        nodes = [
          erb_code_node("if #{COVERED}.size < #{branches.size}"),
          text_node(@markers.statics_open(identifier, version))
        ] #: Array[untyped]

        branches.each do |key, markup|
          nodes.push(erb_code_node(%(unless #{COVERED}["#{key}"])), text_node(markup), erb_code_node("end"))
        end

        nodes.push(text_node(@markers.statics_close), erb_code_node("end"))

        document_node.children.unshift(erb_code_node("#{COVERED} = {}"))
        document_node.children.concat(nodes)
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

        anchors = indices.map { |index|
          slot = @slots[index]

          [index, slot.type, anchor_name_for(slot)]
        }

        open_tag.children << attribute_node("data-herb-slot", @markers.element_anchors(anchors))
      end

      #: (Slot) -> String?
      def anchor_name_for(slot)
        name = slot.attribute

        return nil if name.nil? || name.include?(",")

        name
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
        name = identifier

        document_node.children.unshift(comment_node(@markers.region_open(name, version)))
        document_node.children.push(comment_node(@markers.region_close(name)))
      end

      def text_node(content)
        Herb::AST::HTMLTextNode.new("HTMLTextNode", Herb::Location.zero, [], content.dup)
      end

      def erb_code_node(code)
        Herb::AST::ERBContentNode.new(
          "ERBContentNode", Herb::Location.zero, [],
          token(:erb_start, "<%"), token(:erb_content, " #{code} "), token(:erb_end, "%>"),
          nil, false, true,
          nil
        )
      end

      def erb_output_node(code)
        Herb::AST::ERBContentNode.new(
          "ERBContentNode", Herb::Location.zero, [],
          token(:erb_start, "<%="), token(:erb_content, " #{code} "), token(:erb_end, "%>"),
          nil, false, true,
          nil
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
