# frozen_string_literal: true
# typed: true

require "digest"

require_relative "../../visitor"
require_relative "../context_aware"
require_relative "../experimental"
require_relative "identifier"
require_relative "manifest/channel"
require_relative "types"
require_relative "state_compiler"
require_relative "markers"
require_relative "statics"
require_relative "state_directives"

module Herb
  class Engine
    module Slots
      # Records where a template's dynamic content ends up, and marks those places in the output so
      # something outside Ruby can find them again:
      #
      #     visitor = Herb::Engine::Slots::Visitor.new
      #
      #     Herb::Engine.new(source, visitors: [visitor], filename: "app/views/posts/index.html.erb")
      #
      #     visitor.slots
      #
      # Templates can also ask for this themselves with a `<%# herb:slots %>` directive, and say who
      # renders their branches with `<%# herb:slots client %>`. Deciding what that means belongs to
      # whoever builds the stack, so the directive is only read here:
      #
      #     mode = Herb::Engine::Slots::Visitor.directive_mode(source)
      #     visitors = mode ? [Herb::Engine::Slots::Visitor.new(mode: mode)] : []
      #
      class Visitor < Herb::Visitor
        extend Experimental
        include ContextAware

        recommended_parser_option iteration_nodes: true, render_nodes: true, strict_locals: true
        required_parser_option action_view_helpers: true, track_locations: true
        experimental "Slots are experimental. Their markers, payload and client API may change."

        attr_accessor :bufvar #: String
        attr_reader :markers #: Markers
        attr_reader :slots #: Array[Slot]
        attr_reader :states #: StateCompiler
        attr_reader :document #: untyped
        attr_reader :warnings #: Array[Herb::Warnings::Warning]

        SLOTS_DIRECTIVE = /<%#-?\s*herb:slots\b(?<mode>[^%]*?)-?%>/ #: Regexp
        MODE_OPTION = /\b(server|client)\b/ #: Regexp
        MODES = [:server, :client].freeze #: Array[Symbol]
        DELIVERIES = [:inline, :hoist, :none].freeze #: Array[Symbol]
        COVERED = "@_herb_covered" #: String
        OCCURRENCES = "@_herb_region_occurrences" #: String
        OCCURRENCE = "_herb_occurrence" #: String
        NAME_ATTRIBUTE = "data-herb-name" #: String

        CAPTURING = /\b(?:content_for|provide|capture)\b/ #: Regexp
        OPEN_TAG_TYPES = [Herb::AST::HTMLOpenTagNode, Herb::AST::ERBOpenTagNode].freeze #: Array[Herb::AST::HTMLOpenTagNode|Herb::AST::ERBOpenTagNode]
        BRANCH_BODY_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]
        BRANCH_CONTINUATION_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

        Slot = Data.define(
          :index,          #: Integer
          :type,           #: Symbol
          :node_path,      #: Array[Integer]
          :expression,     #: String?
          :attribute,      #: String?
          :key_source,     #: Symbol?
          :key_expression, #: String?
          :name,           #: String?
          :tag,            #: String?
          :merged_paths    #: Array[Array[Integer]]
        )

        class Slot
          #: () -> bool
          def structural? = Types.structural?(type)

          #: () -> bool
          def attribute? = Types.attribute?(type)

          #: () -> bool
          def anchored? = Types.element_anchored?(type)

          #: () -> bool
          def nameable? = Types.nameable?(type)

          #: () -> bool
          def valued? = Types.valued?(type)

          #: () -> bool
          def presence? = type == :boolean_attribute

          #: () -> bool
          def interpolated? = type == :attribute_interpolation
        end

        #: (String) -> bool
        def self.directive?(source)
          SLOTS_DIRECTIVE.match?(source)
        end

        #: (String) -> Symbol?
        def self.directive_mode(source)
          match = SLOTS_DIRECTIVE.match(source)

          return nil unless match

          named = MODE_OPTION.match(match[:mode])
          mode = named && named[1]

          mode ? mode.to_sym : :server
        end

        #: () -> bool
        def self.reads_erb_source?
          true
        end

        #: (?markers: Markers, ?mode: Symbol, ?identifier: (Symbol | ^(String) -> String), ?mark: bool) -> void
        def initialize(markers: Markers.new, mode: :server, identifier: :path, mark: true, deliver: :hoist)
          super()

          raise ArgumentError, "unknown slot mode #{mode.inspect}, expected one of #{MODES.inspect}" unless MODES.include?(mode)
          raise ArgumentError, "deliver has to be one of #{DELIVERIES.join(", ")}, got #{deliver.inspect}" unless DELIVERIES.include?(deliver)

          @markers = markers
          @mark = mark
          @deliver = deliver
          @bufvar = "_buf"
          @mode = mode
          @statics = mode == :client ? {} : nil #: Hash[String, String]?
          @identify = identifier

          @slots = [] #: Array[Slot]
          @warnings = [] #: Array[Herb::Warnings::Warning]
          @path = [] #: Array[Integer]

          pending = {} #: Hash[untyped, Integer]
          element_anchored = {} #: Hash[untyped, Array[Integer]]
          continuations = {} #: Hash[untyped, bool]
          indices = {} #: Hash[untyped, Integer]

          @pending = pending.compare_by_identity
          @element_anchored = element_anchored.compare_by_identity
          @continuations = continuations.compare_by_identity
          @indices = indices.compare_by_identity

          slot_nodes = [] #: Array[untyped]
          @slot_nodes = slot_nodes
          @tag_stack = [] #: Array[String]
          slot_scopes = {} #: Hash[untyped, untyped]
          @slot_scopes = slot_scopes.compare_by_identity
          @named_elements = [] #: Array[Hash[Symbol, untyped]]
          attribute_open_tags = {} #: Hash[untyped, untyped]
          @attribute_open_tags = attribute_open_tags.compare_by_identity
          @interpolated_attributes = [] #: Array[untyped]
          @states = StateCompiler.new(self)
          @collection_nodes = [] #: Array[untyped]
          @collection_body_depths = [] #: Array[Integer]
          @container_depth = 0

          @in_attribute = false
          @in_open_tag = false
          @displaced = [] #: Array[untyped]
          @in_html_comment = false
          @in_html_doctype = false
          @raw_text_depth = 0
          @rcdata_depth = 0
          @current_open_tag = nil
        end

        #: () -> String
        def version
          @version ||= Digest::SHA256.hexdigest(version_projection.join(",")).slice(0, 8).to_s
        end

        #: () -> Hash[Symbol, untyped]
        def state_declarations
          @states.state_declarations
        end

        #: () -> Array[Hash[Symbol, untyped]]
        def state_entries
          @states.state_entries
        end

        #: () -> Hash[Integer, Hash[Symbol, untyped]]
        def state_conditional_entries
          @states.state_conditional_entries
        end

        #: () -> Hash[Integer, String]
        def state_conditional_signatures
          @states.state_conditional_signatures
        end

        #: () -> Array[Hash[Symbol, untyped]]
        def state_count_entries
          @states.state_count_entries
        end

        #: () -> Hash[Integer, untyped]
        def state_presence
          @states.state_presence
        end

        #: () -> Array[String]
        def seeded_region_states
          @states.seeded_region_states
        end

        #: () -> Hash[Integer, Array[String]]
        def seeded_item_states
          @states.seeded_item_states
        end

        #: () -> untyped
        def current_collection
          @collection_nodes.last
        end

        #: () -> bool
        def in_item_body?
          @container_depth == @collection_body_depths.last
        end

        #: () -> bool
        def inline?
          @in_open_tag || @in_attribute
        end

        #: (untyped) -> untyped
        def open_tag_for(node)
          @attribute_open_tags[node]
        end

        #: () -> Array[untyped]
        attr_reader :slot_nodes

        #: (untyped) -> untyped
        def scope_of(node)
          @slot_scopes[node]
        end

        #: (Integer, Slot) -> void
        def replace_slot(index, slot)
          @slots[index] = slot
        end

        #: (untyped, Integer) -> void
        def assign_index(node, index)
          @indices[node] = index
        end

        #: () -> bool
        def marking?
          @mark
        end

        #: () -> Array[String]
        def version_projection
          conditionals = state_conditional_signatures

          slots = @slots.map { |slot|
            [
              slot.index,
              slot.type,
              slot.node_path,
              slot.attribute,
              slot.name,
              slot.key_source,
              conditionals[slot.index]
            ].inspect
          }

          declarations = state_entries.map { |entry|
            [entry[:name], entry[:kind], entry[:default], entry[:scope], entry[:derived] && StateDirectives.condition_source(entry[:derived])].inspect
          }

          counts = @states.count_signatures

          slots + declarations + counts
        end

        #: () -> String
        def inspect
          parts = [self.class.name, @mode.to_s] #: Array[String]

          parts << "#{@identify} ids" unless @identify == :path
          parts << "deliver=#{@deliver}" unless @deliver == :hoist

          "#<#{parts.join(" ")}>"
        end

        #: () -> String
        def identifier
          @identifier ||= Identifier.new(@identify).call(context.relative_file_path)
        end

        #: () -> Hash[String, untyped]
        def manifest
          {
            "file" => context.relative_file_path,
            "identifier" => identifier,
            "version" => version,
            "names" => manifest_names,
            "parts" => manifest_parts,
            "states" => @states.manifest,
          }
        end

        #: () -> Hash[String, Integer]
        def manifest_names
          names = {} #: Hash[String, Integer]

          @slots.each do |slot|
            name = slot.name

            names[name] = slot.index if name
          end

          names
        end

        #: () -> Hash[String, Array[String]]
        def manifest_parts
          parts = {} #: Hash[String, Array[String]]

          @interpolated_attributes.each do |node|
            index = @indices[node]

            next unless index

            segments = attribute_segments(node)

            next unless segments

            parts[index.to_s] = segments
          end

          parts
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
            entry = entry.merge(name: slot.name) if slot.name

            entry
          }
        end

        #: (untyped) -> Integer?
        def index_for(node)
          @indices[node]
        end

        #: () -> String
        def occurrence_expression
          "((#{OCCURRENCES} ||= ::Hash.new(0))[#{identifier.inspect}] += 1) - 1"
        end

        #: (untyped) -> Array[Integer]
        def anchored_indices_for(open_tag)
          @element_anchored[open_tag] || []
        end

        def visit_document_node(node)
          @document = node

          visit_children_with_paths(node.children)

          collapse_invariant_conditionals
          apply_names

          @states.apply_states
        end

        #: (untyped) -> void
        def finish(node)
          return unless @mark

          insert_markers(node)
          wrap_displaced
          wrap_region(node)
          append_statics(node)
          deliver_manifest(node)
        end

        #: (untyped) -> void
        def deliver_manifest(document_node)
          return if @deliver == :none

          built = manifest

          return if built["names"].empty? && built["parts"].empty? && built["states"].nil?

          json = JSON.generate(built, script_safe: true)
          key = "#{identifier}:#{version}"

          if @deliver == :hoist
            document_node.children.push(erb_code_node("::Herb::Engine::Slots::Manifest::Channel.record(#{key.dump}, #{json.dump})"))

            return
          end

          document_node.children.unshift(erb_code_node("#{COVERED} ||= {}"))

          ref = "#{COVERED}[#{"manifest:#{key}".inspect}]"

          document_node.children.push(
            erb_code_node("unless #{ref}"),
            text_node(@markers.manifests_open),
            text_node("{#{JSON.generate(key)}:#{json}}"),
            text_node(@markers.manifests_close),
            erb_code_node("#{ref} = true"),
            erb_code_node("end")
          )
        end

        def visit_html_element_node(node)
          tag_name = node.tag_name&.value&.downcase.to_s
          raw_text = Herb::HTML::Util.raw_text_element?(tag_name)
          rcdata = Herb::HTML::Util.rcdata_element?(tag_name)

          @raw_text_depth += 1 if raw_text
          @rcdata_depth += 1 if rcdata

          previous_open_tag = @current_open_tag
          @current_open_tag = node.open_tag
          @tag_stack.push(tag_name)

          name_attribute = attributes_for(node).find { |attribute| attribute_name_for(attribute)&.downcase == NAME_ATTRIBUTE }
          base = @slot_nodes.size
          base_scope = @collection_nodes.last
          base_depth = @container_depth

          visit(node.open_tag) if node.open_tag
          visit_children_with_paths(node.body)
          visit(node.close_tag) if node.close_tag

          record_named_element(node, name_attribute, base, base_scope, base_depth) if name_attribute

          @tag_stack.pop
          @current_open_tag = previous_open_tag

          @rcdata_depth -= 1 if rcdata
          @raw_text_depth -= 1 if raw_text
        end

        def visit_erb_strict_locals_node(node)
          (node.locals || []).each do |parameter|
            name = parameter.name&.value.to_s
            next if name.empty?

            @states.declare_local(name, parameter.default_value&.content)
          end

          super
        end

        def visit_html_open_tag_node(node)
          @in_open_tag = true
          super
          @in_open_tag = false
        end

        def visit_erb_open_tag_node(node)
          @in_open_tag = true
          super
          @in_open_tag = false
        end

        def visit_html_attribute_node(node)
          if dynamic?(node)
            record_slot(node, attribute_type_for(node))
            @attribute_open_tags[node] = @current_open_tag
            @interpolated_attributes << node if attribute_type_for(node) == :attribute_interpolation
          end

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
          record_slot(node, erb_outputs?(node) ? :child : nil)

          super
        end

        def visit_erb_render_node(node)
          record_slot(node, erb_outputs?(node) ? :child : nil)

          super
        end

        def visit_erb_yield_node(node)
          record_slot(node, :child)

          super
        end

        def visit_erb_if_node(node)
          return if @states.register_count_fold(node)
          return if convert_helper_boolean_attribute(node)

          record_slot(node, :conditional) unless continuation?(node)

          visit_branching_node(node)
        end

        def visit_erb_unless_node(node)
          record_slot(node, :conditional) unless continuation?(node)

          visit_branching_node(node)
        end

        def visit_erb_else_node(node)
          register_branch_directives(node)
          super
        end

        def visit_erb_when_node(node)
          register_branch_directives(node)
          super
        end

        #: (untyped) -> void
        def register_branch_directives(node)
          BRANCH_BODY_PROPERTIES.each do |property|
            next unless node.respond_to?(property)

            body = node.send(property)
            next unless body.is_a?(Array)

            body.each { |child| @states.register_state_directive(child, body) }
          end
        end

        def visit_erb_case_node(node)
          record_slot(node, :conditional) unless continuation?(node)

          visit_branching_node(node)
        end

        def visit_erb_block_node(node)
          record_slot(node, :block) if erb_outputs?(node)

          @displaced << node if CAPTURING.match?(expression_for(node).to_s)

          visit_branching_node(node)
        end

        def visit_erb_iteration_block_node(node)
          visit_collection_node(node)
        end

        def visit_erb_while_node(node)
          visit_collection_node(node)
        end

        def visit_erb_until_node(node)
          visit_collection_node(node)
        end

        def visit_erb_for_node(node)
          visit_collection_node(node)
        end

        def visit_collection_node(node)
          record_slot(node, :collection)

          @collection_nodes.push(node)
          @collection_body_depths.push(@container_depth + 1)
          visit_branching_node(node)
          @collection_body_depths.pop
          @collection_nodes.pop
        end

        #: (untyped) -> bool
        def continuation?(node)
          @continuations.key?(node)
        end

        #: (untyped) -> bool
        def exhaustive?(node)
          current = continuation_of(node) #: untyped
          last = current #: untyped

          while current
            last = current
            current = continuation_of(current)
          end

          last.is_a?(Herb::AST::ERBElseNode)
        end

        #: (untyped) -> Array[untyped]
        def conditional_chain(node)
          chain = [] #: Array[untyped]
          current = node #: untyped

          while current
            chain << current
            current = continuation_of(current)
          end

          chain
        end

        #: (untyped) -> bool
        def blank_child?(node)
          return true if node.is_a?(Herb::AST::WhitespaceNode)

          if node.is_a?(Herb::AST::HTMLTextNode) || node.is_a?(Herb::AST::LiteralNode)
            return node.content.to_s.strip.empty?
          end

          false
        end

        #: (untyped) -> untyped
        def continuation_of(node)
          subsequent = node.respond_to?(:subsequent) ? node.subsequent : nil

          subsequent || (node.respond_to?(:else_clause) ? node.else_clause : nil)
        end

        def text_node(content)
          Herb::AST::HTMLTextNode.build(content: content.dup)
        end

        def erb_code_node(code)
          Herb::AST::ERBContentNode.build(
            tag_opening: token(:erb_start, "<%"),
            content: token(:erb_content, " #{code} "),
            tag_closing: token(:erb_end, "%>"),
            valid: true
          )
        end

        def erb_output_node(code)
          Herb::AST::ERBContentNode.build(
            tag_opening: token(:erb_start, "<%="),
            content: token(:erb_content, " #{code} "),
            tag_closing: token(:erb_end, "%>"),
            valid: true
          )
        end

        private

        def visit_children_with_paths(children)
          return unless children.is_a?(Array)

          children.each_with_index do |child, index|
            @states.register_state_directive(child, children)
            @states.check_state_assignment(child)

            @path.push(index)
            visit(child)
            @path.pop
          end
        end

        def visit_branching_node(node)
          @container_depth += 1

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

          @container_depth -= 1
        end

        #: () -> void
        def collapse_invariant_conditionals
          merged = {} #: Hash[Integer, Integer]
          dropped = {} #: Hash[Integer, bool]
          covered = Hash.new { |hash, key| hash[key] = [] } #: Hash[Integer, Array[Integer]]

          @pending.each do |node, index|
            next unless @slots[index].type == :conditional
            next unless exhaustive?(node)

            bodies = branch_bodies(node)
            next unless bodies.size > 1

            signatures = bodies.filter_map { |body| Statics.new(@pending, @slots, @element_anchored).signature(body) }
            next unless signatures.size == bodies.size

            shapes = signatures.map { |shape, _| shape }
            next unless shapes.uniq.one?
            next if branching_shape?(shapes.fetch(0))

            positions = signatures.map { |_, indices| indices }
            shared = positions.fetch(0)

            dropped[index] = true

            shared.each { |survivor| covered[survivor] << index }

            positions.drop(1).each do |indices|
              indices.each_with_index do |old, position|
                survivor = shared.fetch(position)

                merged[old] = survivor
                covered[survivor] << old
              end
            end
          end

          renumber(merged, dropped, covered) unless dropped.empty?
        end

        #: (String) -> bool
        def branching_shape?(shape)
          Types::STRUCTURAL.any? { |type| shape.include?("\u0000#{type}\u0000") }
        end

        #: (Hash[Integer, Integer], Hash[Integer, bool], Hash[Integer, Array[Integer]]) -> void
        def renumber(merged, dropped, covered)
          survivors = (0...@slots.size).reject { |index| dropped[index] || merged.key?(index) }
          moved = survivors.each_with_index.to_h #: Hash[Integer, Integer]
          resolve = ->(index) { moved.fetch(merged.fetch(index, index)) }
          paths_for = ->(index) { covered.fetch(index, []).map { |other| @slots[other].node_path } }

          @slots = survivors.each_with_index.map { |old, index| @slots[old].with(index: index, merged_paths: paths_for.call(old)) }
          @slot_nodes = survivors.map { |old| @slot_nodes.fetch(old) }

          renumbered = {} #: Hash[untyped, Integer]
          pending = renumbered.compare_by_identity

          @pending.each do |node, index|
            pending[node] = resolve.call(index) unless dropped[index]
          end

          @pending = pending

          @element_anchored.each do |open_tag, indices|
            @element_anchored[open_tag] = indices.map { |index| resolve.call(index) }
          end

          recorded = {} #: Hash[untyped, Integer]
          lookup = recorded.compare_by_identity

          @indices.each do |node, index|
            lookup[node] = resolve.call(index) unless dropped[index]
          end

          @indices = lookup
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
            attribute: attribute_name_for(node),
            key_source: key_source,
            key_expression: key_expression,
            name: nil,
            tag: @tag_stack.last,
            merged_paths: []
          )

          @slots << slot
          @slot_nodes << node
          @slot_scopes[node] = [@collection_nodes.last, @container_depth]
          @indices[node] = slot.index

          if type == :collection && key_source == :index
            @warnings << Herb::Warnings::UnkeyedCollectionWarning.new(
              node.location,
              expression_for(node),
              tag_name: keyable_tag_name_for(node)
            )
          end

          if !Types.element_anchored?(type)
            @pending[node] = slot.index
          elsif @current_open_tag
            anchored = @element_anchored[@current_open_tag] || [] #: Array[Integer]
            anchored << slot.index

            @element_anchored[@current_open_tag] = anchored
          end
        end

        #: (Symbol) -> Symbol?
        def anchored_type_for(type)
          return type if Types.attribute_value?(type)

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

        #: (untyped) -> untyped
        def convert_helper_boolean_attribute(node)
          open_tag = @current_open_tag

          return nil unless @in_open_tag && open_tag.is_a?(Herb::AST::ERBOpenTagNode)
          return nil if continuation?(node)
          return nil unless node.respond_to?(:subsequent) && node.subsequent.nil?

          children = open_tag.children

          position = children.index { |child| child.equal?(node) }
          return nil unless position

          statements = node.statements
          return nil unless statements.is_a?(Array) && statements.one?

          attribute = statements.fetch(0)
          return nil unless attribute.is_a?(Herb::AST::HTMLAttributeNode) && !dynamic?(attribute)

          name = attribute_name_for(attribute)
          return nil unless name && Herb::HTML::Util.boolean_attribute?(name)

          condition = @states.condition_expression(node)
          replacement = erb_output_node(%[(" #{name}" if #{condition})])

          children[position] = replacement
          record_slot(replacement, :attribute)

          index = @indices[replacement]
          return nil unless index

          @slots[index] = @slots[index].with(type: :boolean_attribute, attribute: name, expression: condition)
          @attribute_open_tags[replacement] = open_tag

          replacement
        end

        #: (untyped, untyped, Integer, untyped, Integer) -> void
        def record_named_element(node, name_attribute, base, base_scope, base_depth)
          name = static_attribute_value(name_attribute)

          unless name && !name.empty?
            raise Herb::Engine::CompilationError, "`#{NAME_ATTRIBUTE}` on `<#{node.tag_name&.value}>` must be a static, non-empty value; a slot name is an address, so it cannot be computed"
          end

          candidates = @slot_nodes[base..].to_a.select { |slot_node|
            scope, depth = @slot_scopes[slot_node]

            scope.equal?(base_scope) && depth == base_depth && @slots[@indices[slot_node]].nameable?
          }

          @named_elements << {
            node: node,
            open_tag: node.open_tag,
            attribute: name_attribute,
            name: name,
            candidates: candidates,
            scope: base_scope,
          }
        end

        #: (untyped) -> String?
        def static_attribute_value(attribute)
          children = attribute.value&.children || []

          return nil unless children.all?(Herb::AST::LiteralNode)

          children.map { |child| child.content.to_s }.join.strip
        end

        #: () -> void
        def apply_names
          taken = {} #: Hash[untyped, Hash[String, Integer]]

          @named_elements.each { |named| bind_name(named, taken[named[:scope]] ||= {}) }
        end

        #: (Hash[Symbol, untyped], Hash[String, Integer]) -> void
        def bind_name(named, scope_names)
          name = named[:name] #: String
          index = resolve_named_slot(named)

          if scope_names.key?(name)
            raise Herb::Engine::CompilationError, "two slots in the same scope are both named `#{name}`; a slot name is an address, so it has to be unique"
          end

          if (existing = @slots[index].name)
            raise Herb::Engine::CompilationError, "`#{NAME_ATTRIBUTE}=\"#{name}\"` claims the slot already named `#{existing}`; both elements hold the same slot, so keep one name or wrap what each should address"
          end

          if attribute_conflict?(name, index, named[:scope])
            raise Herb::Engine::CompilationError, "the name `#{name}` collides with the `#{name}` attribute slot in the same scope; an attribute slot is already addressable by its attribute"
          end

          scope_names[name] = index

          @slots[index] = @slots[index].with(name: name)
        end

        #: (Hash[Symbol, untyped]) -> Integer
        def resolve_named_slot(named)
          name = named[:name]
          tag = named[:node].tag_name&.value
          candidates = named[:candidates].map { |slot_node| @indices[slot_node] }.compact.uniq

          if candidates.empty?
            raise Herb::Engine::CompilationError, "`#{NAME_ATTRIBUTE}=\"#{name}\"` on `<#{tag}>` names no slot; the element holds nothing dynamic"
          end

          unless candidates.one?
            raise Herb::Engine::CompilationError, "`#{NAME_ATTRIBUTE}=\"#{name}\"` on `<#{tag}>` is ambiguous between #{candidates.size} slots; wrap the one it should name in its own element"
          end

          candidates.fetch(0)
        end

        #: (String, Integer, untyped) -> bool
        def attribute_conflict?(name, index, scope)
          @slots.each_with_index.any? { |slot, slot_index|
            slot.attribute == name && slot_index != index && @slot_scopes[@slot_nodes[slot_index]]&.fetch(0).equal?(scope)
          }
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
            when Herb::AST::RubyLiteralNode
              expression = child.content.to_s.strip
              return nil if expression.empty?

              [:expression, expression]
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

        #: (untyped) -> Array[Herb::AST::HTMLAttributeNode]
        def attributes_for(element)
          open_tag = element.open_tag
          return [] unless OPEN_TAG_TYPES.any? { |type| open_tag.is_a?(type) }

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
          return true if node.is_a?(Herb::AST::RubyLiteralNode)

          node.compact_child_nodes.any? { |child| dynamic?(child) }
        end

        def expression_for(node)
          return attribute_expression_for(node) if node.is_a?(Herb::AST::HTMLAttributeNode)
          return nil unless node.respond_to?(:content)

          content = node.content
          value = content.respond_to?(:value) ? content.value : content

          value&.to_s&.strip
        end

        #: (untyped) -> String?
        def attribute_expression_for(node)
          children = node.value&.children || []
          literal = children.grep(Herb::AST::RubyLiteralNode)

          return literal.fetch(0).content.to_s.strip if literal.one? && children.one?
          return nil unless children.all? { |child| child.is_a?(Herb::AST::LiteralNode) || child.is_a?(Herb::AST::ERBContentNode) }

          outputs = children.grep(Herb::AST::ERBContentNode)

          return nil unless outputs.one?
          return nil unless erb_outputs?(outputs.fetch(0))

          outputs.fetch(0).content&.value&.strip
        end

        def insert_markers(node)
          anchored = content_anchor_index(node)

          each_child_array(node) do |array|
            index = 0

            while index < array.size
              child = array[index]
              slot_index = @pending[child]

              insert_markers(child)
              wrap_items(child, slot_index)
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

          anchor_attributes(node, anchored)
        end

        #: (untyped) -> Integer?
        def content_anchor_index(node)
          return nil unless node.is_a?(Herb::AST::HTMLElementNode)

          body = node.body
          return nil unless body.is_a?(Array) && body.size == 1

          slot_index = @pending[body[0]]
          return nil unless slot_index
          return nil unless @slots[slot_index].type == :child

          slot_index
        end

        #: (untyped, Integer?) -> void
        def mark_branches(node, slot_index)
          return unless slot_index
          return unless @slots[slot_index].type == :conditional

          always = @states.always_taken?(node)

          branch_bodies(node).each_with_index do |body, branch_index|
            body.unshift(text_node(@markers.branch(slot_index, branch_index)))

            park_branch(@markers.statics_key(slot_index, branch_index), body, always: always)
          end
        end

        #: (String, Array[untyped], ?always: bool) -> void
        def park_branch(key, body, always: false)
          statics = @statics
          return unless statics

          markup = Statics.new(@pending).markup(body)
          return unless markup

          statics[key] = markup

          body.insert(1, erb_code_node(%(#{COVERED}[#{covered_key(key).inspect}] = true))) unless always
        end

        #: (Herb::AST::DocumentNode) -> void
        def append_statics(document_node)
          statics = @statics
          return if statics.nil? || statics.empty?

          branches = statics.sort_by { |key, _| key.split(":").map(&:to_i) }
          seen = branches.map { |key, _| "#{COVERED}[#{covered_key(key).inspect}]" }.join(" && ")

          nodes = [
            erb_code_node("unless #{seen}"),
            text_node(@markers.statics_open(identifier, version))
          ] #: Array[Herb::AST::Node]

          branches.each do |key, markup|
            reference = "#{COVERED}[#{covered_key(key).inspect}]"

            nodes.push(erb_code_node("unless #{reference}"), text_node(markup), erb_code_node("#{reference} = true"), erb_code_node("end"))
          end

          nodes.push(text_node(@markers.statics_close), erb_code_node("end"))

          document_node.children.unshift(erb_code_node("#{COVERED} ||= {}"))
          document_node.children.concat(nodes)
        end

        #: (String) -> String
        def covered_key(key)
          "#{identifier}:#{key}"
        end

        #: (untyped) -> Array[Array[Herb::AST::Node]]
        def branch_bodies(node)
          bodies = [] #: Array[Array[Herb::AST::Node]]

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

        #: (Herb::AST::Node, Integer?) -> void
        def wrap_items(node, slot_index)
          return unless slot_index

          slot = @slots[slot_index]
          return unless slot.type == :collection && slot.key_expression

          BRANCH_BODY_PROPERTIES.each do |property|
            next unless node.respond_to?(property)

            body = node.send(property)
            next unless body.is_a?(Array) && !body.empty?

            key = @markers.item_statics_key(slot_index)
            parked = park_item(key, body)

            body.unshift(
              text_node(@markers.item_open_prefix(slot_index)),
              erb_code_node("#{@bufvar} << ::Herb::Engine.raw((#{slot.key_expression}).to_s)"),
              text_node(@markers.item_open_suffix)
            )

            body.insert(3, erb_code_node(%(#{COVERED}[#{covered_key(key).inspect}] = true))) if parked

            body.push(text_node(@markers.item_close(slot_index)))
          end
        end

        #: (untyped) -> Array[String]?
        def attribute_segments(node)
          segments = [+""]

          (node.value&.children || []).each do |child|
            case child
            when Herb::AST::LiteralNode
              segments.last << child.content.to_s
            when Herb::AST::ERBContentNode
              return nil unless erb_outputs?(child)

              segments << +""
            else
              return nil
            end
          end

          segments.size > 1 ? segments : nil
        end

        #: (untyped, untyped) -> Array[untyped]?
        def park_item(key, body)
          statics = @statics
          return unless statics

          slot_index = key.split(":").first.to_i
          markup = Statics.new(@pending).markup(body)
          return unless markup

          statics[key] = [
            @markers.branch(slot_index, Markers::ITEM_STATICS),
            @markers.item_open_prefix(slot_index),
            @markers.item_open_suffix,
            markup,
            @markers.item_close(slot_index)
          ].join
        end

        def anchor_attributes(node, content_index = nil)
          return unless node.is_a?(Herb::AST::HTMLElementNode)

          open_tag = node.open_tag
          return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode) || open_tag.is_a?(Herb::AST::ERBOpenTagNode)

          anchors = (@element_anchored[open_tag] || []).map { |index|
            slot = @slots[index]

            [index, slot.type, anchor_name_for(slot)]
          }

          anchors << [content_index, :child, nil] if content_index

          return if anchors.empty?

          open_tag.children << attribute_node("data-herb-slot", @markers.element_anchors(anchors))
        end

        #: (Slot) -> String?
        def anchor_name_for(slot)
          name = slot.attribute

          return nil if name.nil? || name.include?(",")

          name
        end

        #: (Herb::AST::Node) { (Array[untyped]) -> void } -> void
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

        #: (Herb::AST::DocumentNode) -> void
        def wrap_region(document_node)
          document_node.children.unshift(
            erb_code_node("#{OCCURRENCE} = #{occurrence_expression}"),
            *region_open
          )

          document_node.children.push(comment_node(@markers.region_close(identifier)))
        end

        #: () -> void
        def wrap_displaced
          @displaced.each do |node|
            BRANCH_BODY_PROPERTIES.each do |property|
              next unless node.respond_to?(property)

              body = node.send(property)
              next unless body.is_a?(Array) && !body.empty?

              body.unshift(*region_open)
              body.push(comment_node(@markers.region_close(identifier)))
            end
          end
        end

        def region_open
          [
            text_node(@markers.region_open_prefix(identifier, version)),
            erb_output_node(OCCURRENCE),
            text_node(@markers.region_open_suffix)
          ]
        end

        def comment_node(text)
          Herb::AST::HTMLCommentNode.build(
            comment_start: token(:html_comment_start, text),
            comment_end: token(:html_comment_end, "")
          )
        end

        def attribute_node(name, value)
          name_node = Herb::AST::HTMLAttributeNameNode.build(children: [literal(name)])

          value_node = Herb::AST::HTMLAttributeValueNode.build(
            open_quote: token(:quote, '"'),
            children: [literal(value)],
            close_quote: token(:quote, '"'),
            quoted: true
          )

          Herb::AST::HTMLAttributeNode.build(name: name_node, equals: token(:equals, "="), value: value_node)
        end

        def literal(content)
          Herb::AST::LiteralNode.build(content: content.dup)
        end

        def token(type, value)
          Herb::Token.new(value.dup, Herb::Range.zero, Herb::Location.zero, type.to_s)
        end
      end
    end
  end
end
