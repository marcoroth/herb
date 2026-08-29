# frozen_string_literal: true
# typed: true

require "digest"

require_relative "../../visitor"
require_relative "../../visitor/context_aware"
require_relative "../../visitor/diagnostics"
require_relative "../../visitor/experimental"
require_relative "annotation"
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
        extend Herb::Visitor::Experimental
        include Herb::Visitor::ContextAware
        include Herb::Visitor::Diagnostics

        recommended_parser_option iteration_nodes: true, render_nodes: true, strict_locals: true
        required_parser_option action_view_helpers: true, track_locations: true, herb_directives: true
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

        MARKED_NODE_FIELDS = [:end_node, :open_tag].freeze #: Array[Symbol]

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

        #: (?markers: Markers, ?mode: Symbol, ?identifier: (Symbol | ^(String) -> String), ?mark: bool, ?deliver: Symbol, ?fatal: bool) -> void
        def initialize(markers: Markers.new, mode: :server, identifier: :path, mark: true, deliver: :hoist, fatal: true)
          super(fatal: fatal)

          raise ArgumentError, "`mode: #{mode.inspect}` is not a slot mode. Pass one of #{MODES.map(&:inspect).join(", ")}." unless MODES.include?(mode)
          raise ArgumentError, "`deliver: #{deliver.inspect}` is not a delivery. Pass one of #{DELIVERIES.map(&:inspect).join(", ")}." unless DELIVERIES.include?(deliver)

          @markers = markers
          @mark = mark
          @degraded = false
          @deliver = deliver
          @bufvar = "_buf"
          @mode = mode
          @statics = mode == :client ? {} : nil #: Hash[String, String]?
          @identify = identifier

          @slots = [] #: Array[Slot]
          @warnings = [] #: Array[Herb::Warnings::Warning]
          @path = [] #: Array[Integer]

          @annotations = [] #: Array[Annotation]

          standing = {} #: Hash[untyped, Annotation]
          annotation_of = {} #: Hash[untyped, Annotation]
          element_anchored = {} #: Hash[untyped, Array[Annotation]]
          continuations = {} #: Hash[untyped, bool]
          indices = {} #: Hash[untyped, Integer]

          @standing = standing.compare_by_identity
          @annotation_of = annotation_of.compare_by_identity
          @element_anchored = element_anchored.compare_by_identity
          @continuations = continuations.compare_by_identity
          @indices = indices.compare_by_identity

          @slot_nodes = [] #: Array[untyped]
          @tag_stack = [] #: Array[String]
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

        #: () -> bool
        def degraded?
          @degraded
        end

        #: (String, Herb::Location?, Symbol) -> nil
        def slot_error(message, location, family)
          error(message, location, code: "slots-#{family}")

          @degraded = true

          nil
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
          annotation = @annotation_of[node]

          annotation && [annotation.scope, annotation.depth]
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
          parts << "fatal=#{fatal?}" unless fatal?

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

        #: () -> Array[String]
        def recorded_expressions
          @annotations.map { |annotation| annotation.expression.to_s }
        end

        #: (untyped) -> Integer?
        def index_for(node)
          @indices[node]
        end

        #: () -> String
        def occurrence_expression
          "((#{OCCURRENCES} ||= ::Hash.new(0))[#{identifier.inspect}] += 1) - 1"
        end

        def visit_document_node(node)
          @document = node

          visit_children_with_paths(node.children)

          collapse_invariant_conditionals
          apply_names
          number_slots

          @states.apply_states
        end

        #: (untyped) -> void
        def finish(node)
          return unless @mark

          return wrap_region(node) if @degraded

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
          base = @annotations.size
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
          node.content_node_lists.each do |list|
            list.nodes.each { |child| @states.register_state_directive(child, list.nodes) }
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

          node.content_node_lists.each { |list| visit_children_with_paths(list.nodes) }

          node.continuation_nodes.each do |child|
            @continuations[child] = true
            visit(child)
          end

          @container_depth -= 1
        end

        #: () -> void
        def collapse_invariant_conditionals
          @standing.each_value do |annotation|
            next unless annotation.type == :conditional
            next unless exhaustive?(annotation.node)

            bodies = branch_bodies(annotation.node)
            next unless bodies.size > 1

            signatures = bodies.filter_map { |body| Statics.new(@standing, @element_anchored).signature(body) }
            next unless signatures.size == bodies.size

            shapes = signatures.map { |shape, _| shape }
            next unless shapes.uniq.one?
            next if branching_shape?(shapes.fetch(0))

            positions = signatures.map { |_, found| found }
            shared = positions.fetch(0)

            annotation.dropped = true

            shared.each { |survivor| survivor.covered << annotation }

            positions.drop(1).each do |found|
              found.each_with_index do |other, position|
                survivor = shared.fetch(position)

                other.merged_into = survivor
                survivor.covered << other
              end
            end
          end

          @standing.delete_if { |_node, annotation| annotation.dropped }
        end

        #: (String) -> bool
        def branching_shape?(shape)
          Types::STRUCTURAL.any? { |type| shape.include?("\u0000#{type}\u0000") }
        end

        #: () -> void
        def number_slots
          surviving = @annotations.reject(&:gone?)

          surviving.each_with_index { |annotation, index| annotation.index = index }

          @slots = surviving.each_with_index.map { |annotation, index| annotation.to_slot(index) }
          @slot_nodes = surviving.map(&:node)

          @annotations.each do |annotation|
            next if annotation.dropped

            @indices[annotation.node] = annotation.survivor.index
          end
        end

        #: (untyped, Symbol?) -> void
        def record_slot(node, type)
          return unless type

          type = anchored_type_for(type)

          return unless type
          return if @in_html_comment || @in_html_doctype

          key_source, key_expression = type == :collection ? key_for(node) : [nil, nil]

          annotation = Annotation.new(
            node: node,
            type: type,
            node_path: @path.dup,
            expression: expression_for(node),
            attribute: attribute_name_for(node),
            key_source: key_source,
            key_expression: key_expression,
            tag: @tag_stack.last,
            scope: @collection_nodes.last,
            depth: @container_depth
          )

          @annotations << annotation
          @annotation_of[node] = annotation

          if type == :collection && key_source == :index
            @warnings << Herb::Warnings::UnkeyedCollectionWarning.new(
              node.location,
              expression_for(node),
              tag_name: keyable_tag_name_for(node)
            )
          end

          if !annotation.anchored?
            @standing[node] = annotation
          elsif @current_open_tag
            anchored = @element_anchored[@current_open_tag] || [] #: Array[Annotation]
            anchored << annotation

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

          annotation = @annotation_of[replacement]
          return nil unless annotation

          annotation.type = :boolean_attribute
          annotation.attribute = name
          annotation.expression = condition

          @attribute_open_tags[replacement] = open_tag

          replacement
        end

        #: (untyped, untyped, Integer, untyped, Integer) -> void
        def record_named_element(node, name_attribute, base, base_scope, base_depth)
          name = static_attribute_value(name_attribute)

          unless name && !name.empty?
            return slot_error("`#{NAME_ATTRIBUTE}` on `<#{node.tag_name&.value}>` is computed or empty. A slot name is an address the browser looks up, so give it a static, non-empty value.", name_attribute.location, :name)
          end

          candidates = @annotations[base..].to_a.select { |annotation|
            annotation.scope.equal?(base_scope) && annotation.depth == base_depth && annotation.nameable?
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
          taken = {} #: Hash[untyped, Hash[String, Annotation]]

          @named_elements.each { |named| bind_name(named, taken[named[:scope]] ||= {}) }
        end

        #: (Hash[Symbol, untyped], Hash[String, Annotation]) -> void
        def bind_name(named, scope_names)
          name = named[:name] #: String
          annotation = resolve_named_slot(named)

          return unless annotation

          if scope_names.key?(name)
            return slot_error("Two slots in the same scope are both named `#{name}`. A slot name is an address, so give one of them a different name.", name_location(named), :name)
          end

          if (existing = annotation.name)
            return slot_error("`#{NAME_ATTRIBUTE}=\"#{name}\"` claims the slot already named `#{existing}`. Both elements hold the same slot, so keep one name or wrap what each should address in its own element.", name_location(named), :name)
          end

          if attribute_conflict?(name, annotation, named[:scope])
            return slot_error("The name `#{name}` collides with the `#{name}` attribute slot in the same scope. An attribute slot is already addressable by its attribute, so drop the name or rename it.", name_location(named), :name)
          end

          scope_names[name] = annotation

          annotation.name = name
        end

        #: (Hash[Symbol, untyped]) -> Annotation?
        def resolve_named_slot(named)
          name = named[:name]
          tag = named[:node].tag_name&.value
          candidates = named[:candidates].reject(&:dropped).map(&:survivor).uniq

          if candidates.empty?
            return slot_error("`#{NAME_ATTRIBUTE}=\"#{name}\"` on `<#{tag}>` names no slot, since the element holds nothing dynamic. Move the name onto an element that wraps an ERB output, or remove it.", name_location(named), :name)
          end

          unless candidates.one?
            return slot_error("`#{NAME_ATTRIBUTE}=\"#{name}\"` on `<#{tag}>` is ambiguous between #{candidates.size} slots. Wrap the one it should name in its own element.", name_location(named), :name)
          end

          candidates.fetch(0)
        end

        #: (Hash[Symbol, untyped]) -> Herb::Location?
        def name_location(named)
          named[:attribute]&.location || named[:node]&.location
        end

        #: (String, Annotation, untyped) -> bool
        def attribute_conflict?(name, annotation, scope)
          @annotations.any? { |other|
            !other.gone? && other.attribute == name && !other.equal?(annotation) && other.scope.equal?(scope)
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
            next unless child.is_a?(Herb::AST::HerbDirectiveNode)
            next unless child.key&.value == "key"

            expression = child.arguments&.value.to_s.strip

            return expression unless expression.empty?
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
          node.content_node_lists.flat_map(&:nodes)
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
              slot_index = @standing[child]&.survivor&.index

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

          annotation = @standing[body[0]]&.survivor
          return nil unless annotation
          return nil unless annotation.type == :child

          annotation.index
        end

        #: (untyped, Integer?) -> void
        def mark_branches(node, slot_index)
          return unless slot_index
          return unless @slots[slot_index].type == :conditional

          branch_bodies(node).each_with_index do |body, branch_index|
            body.unshift(text_node(@markers.branch(slot_index, branch_index)))

            park_branch(@markers.statics_key(slot_index, branch_index), body)
          end
        end

        #: (String, Array[untyped]) -> void
        def park_branch(key, body)
          statics = @statics
          return unless statics

          markup = Statics.new(@standing).markup(body)
          return unless markup

          statics[key] = markup
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

          node.content_node_lists.each do |list|
            body = list.nodes
            next if body.empty?

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
          markup = Statics.new(@standing).markup(body)
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

          anchors = (@element_anchored[open_tag] || []).map { |annotation|
            slot = @slots.fetch(annotation.survivor.index)

            [slot.index, slot.type, anchor_name_for(slot)]
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
          node.content_node_lists.each { |list| yield list.nodes }

          node.continuation_nodes.each { |child| insert_markers(child) }

          MARKED_NODE_FIELDS.each do |property|
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
            node.content_node_lists.each do |list|
              body = list.nodes
              next if body.empty?

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
