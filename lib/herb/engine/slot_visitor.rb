# frozen_string_literal: true
# typed: true

require "digest"

require_relative "../visitor"
require_relative "context_aware"
require_relative "slot_markers"
require_relative "slot_statics"
require_relative "state_directives"

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

      recommended_parser_option iteration_nodes: true, render_nodes: true, strict_locals: true
      required_parser_option action_view_helpers: true, track_locations: true

      attr_reader :slots #: Array[Slot]
      attr_reader :state_presence #: Hash[Integer, StateDirectives::Read]
      attr_reader :document #: untyped
      attr_reader :warnings #: Array[Herb::Warnings::Warning]

      SLOTS_DIRECTIVE = /<%#-?\s*herb:slots\b(?<mode>[^%]*?)-?%>/ #: Regexp
      PART_MARKER = "<!--herb-part-->" #: String
      MODE_OPTION = /\b(server|client)\b/ #: Regexp
      MODES = [:server, :client].freeze #: Array[Symbol]
      COVERED = "_herb_covered_branches" #: String
      ITEM_STATICS = "item" #: String
      OCCURRENCES = "@_herb_region_occurrences" #: String
      OCCURRENCE = "_herb_occurrence" #: String

      CAPTURING = /\b(?:content_for|provide|capture)\b/ #: Regexp
      BRANCHING_TYPES = [:conditional, :collection, :block].freeze #: Array[Symbol]

      ATTRIBUTE_TYPES = [:attribute, :attribute_interpolation].freeze #: Array[Symbol]
      ELEMENT_ANCHORED_TYPES = [*ATTRIBUTE_TYPES, :boolean_attribute, :element, :raw_text].freeze #: Array[Symbol]
      OPEN_TAG_TYPES = [Herb::AST::HTMLOpenTagNode, Herb::AST::ERBOpenTagNode].freeze #: Array[Herb::AST::HTMLOpenTagNode|Herb::AST::ERBOpenTagNode]
      BRANCH_BODY_PROPERTIES = [:statements, :body, :children, :conditions].freeze #: Array[Symbol]
      BRANCH_CONTINUATION_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze #: Array[Symbol]

      STATE_KEYWORDS = {
        "if" => :if, "elsif" => :elsif, "unless" => :unless, "case" => :case, "when" => :when,
      }.freeze #: Hash[String, Symbol]

      NAME_ATTRIBUTE = "data-herb-name" #: String
      NAMEABLE_TYPES = [:child, :collection, :conditional, :block].freeze #: Array[Symbol]

      Slot = Data.define(
        :index,      #: Integer
        :type,       #: Symbol
        :node_path,  #: Array[Integer]
        :expression, #: String?
        :location,   #: String?
        :attribute,  #: String?
        :key_source, #: Symbol?
        :key_expression, #: String?
        :name, #: String?
        :tag #: String?
      )

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

      #: (?markers: SlotMarkers, ?mode: Symbol, ?identifier: (Symbol | ^(String) -> String), ?mark: bool) -> void
      def initialize(markers: SlotMarkers.new, mode: :server, identifier: :path, mark: true)
        super()

        raise ArgumentError, "unknown slot mode #{mode.inspect}, expected one of #{MODES.inspect}" unless MODES.include?(mode)

        @markers = markers
        @mark = mark
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
        @state_presence = {} #: Hash[Integer, StateDirectives::Read]
        @interpolated_attributes = [] #: Array[untyped]
        @strict_locals = {} #: Hash[String, Symbol]
        @region_states = {} #: Hash[String, StateDirectives::Declaration]
        item_states = {} #: Hash[untyped, Hash[String, StateDirectives::Declaration]]
        @item_states = item_states.compare_by_identity
        @state_directives = [] #: Array[Hash[Symbol, untyped]]
        state_conditionals = {} #: Hash[untyped, Hash[Symbol, untyped]]
        @state_conditionals = state_conditionals.compare_by_identity
        @collection_nodes = [] #: Array[untyped]
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
        @version ||= Digest::SHA256.hexdigest(
          (slot_entries.map(&:inspect) + state_entries.map(&:inspect)).join(",")
        ).slice(0, 8).to_s
      end

      #: () -> Hash[Symbol, untyped]
      def state_declarations
        items = {} #: Hash[Integer, Array[Hash[Symbol, untyped]]]

        @item_states.each do |scope, declarations|
          index = @indices[scope]

          items[index] = declarations.values.map(&:to_h) if index
        end

        { region: @region_states.values.map(&:to_h), items: items }
      end

      #: () -> Array[Hash[Symbol, untyped]]
      def state_entries
        declared = state_declarations

        entries = declared[:region].map { |declaration| declaration.merge(scope: :region) }

        declared[:items].sort.each do |index, declarations|
          entries += declarations.map { |declaration| declaration.merge(scope: index) }
        end

        entries
      end

      #: () -> Hash[Integer, Hash[Symbol, untyped]]
      def state_conditional_entries
        resolved = {} #: Hash[Integer, Hash[Symbol, untyped]]

        @state_conditionals.each do |node, info|
          index = @indices[node]

          resolved[index] = info if index
        end

        resolved
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
          entry = entry.merge(name: slot.name) if slot.name

          info = state_conditional_entries[slot.index]
          entry = entry.merge(state_arms: info[:arms], state_else: info[:else]) if info

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
        apply_states

        return unless @mark

        park_attribute_parts
        insert_markers(node)
        wrap_displaced
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

          @strict_locals[name] = local_kind(parameter.default_value&.content)
        end

        super
      end

      def visit_html_open_tag_node(node)
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
        record_slot(node, erb_output?(node.tag_opening&.value.to_s) ? :child : nil)

        super
      end

      def visit_erb_render_node(node)
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

          body.each { |child| register_state_directive(child, body) }
        end
      end

      def visit_erb_case_node(node)
        record_slot(node, :conditional) unless continuation?(node)

        visit_branching_node(node)
      end

      def visit_erb_block_node(node)
        record_slot(node, :block)

        @displaced << node if CAPTURING.match?(expression_for(node).to_s)

        visit_branching_node(node)
      end

      def visit_erb_iteration_block_node(node)
        record_slot(node, :collection)

        @collection_nodes.push(node)
        visit_branching_node(node)
        @collection_nodes.pop
      end

      def visit_erb_while_node(node)
        record_slot(node, :collection)

        @collection_nodes.push(node)
        visit_branching_node(node)
        @collection_nodes.pop
      end

      def visit_erb_until_node(node)
        record_slot(node, :collection)

        @collection_nodes.push(node)
        visit_branching_node(node)
        @collection_nodes.pop
      end

      def visit_erb_for_node(node)
        record_slot(node, :collection)

        @collection_nodes.push(node)
        visit_branching_node(node)
        @collection_nodes.pop
      end

      private

      def visit_children_with_paths(children)
        return unless children.is_a?(Array)

        children.each_with_index do |child, index|
          register_state_directive(child, children)

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
        current = continuation_of(node) #: untyped
        last = current #: untyped

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
          location: location_for(node),
          attribute: attribute_name_for(node),
          key_source: key_source,
          key_expression: key_expression,
          name: nil,
          tag: @tag_stack.last
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

      #: (untyped, Array[untyped]) -> void
      def register_state_directive(node, parent)
        signature = StateDirectives.signature_of(node)

        return unless signature

        scope = @collection_nodes.last
        declared = StateDirectives.parse(signature, @strict_locals)
        empty = {} #: Hash[String, StateDirectives::Declaration]
        bucket = scope ? (@item_states[scope] ||= empty) : @region_states

        location = node.location&.start

        declared = declared.map { |declaration|
          declaration.with(line: location&.line, column: location&.column)
        }

        declared.each do |declaration|
          if @strict_locals.key?(declaration.name)
            raise Herb::Engine::CompilationError,
                  "`#{declaration.name}` is both a strict local and a state; a local comes from the caller and a " \
                  "state is client-owned, so one name cannot be both"
          end

          if bucket.key?(declaration.name)
            raise Herb::Engine::CompilationError, "the state `#{declaration.name}` is declared twice in the same scope"
          end

          shadowed = scope ? @region_states.key?(declaration.name) : @item_states.values.any? { |declarations| declarations.key?(declaration.name) }

          if shadowed
            raise Herb::Engine::CompilationError,
                  "the state `#{declaration.name}` is declared in both an item and its region; a later read would " \
                  "be ambiguous, so pick two names"
          end

          bucket[declaration.name] = declaration
        end

        @state_directives << { node: node, parent: parent, scope: scope }
      end

      #: (String?) -> Symbol
      def local_kind(source)
        return :seeded if source.nil? || source.to_s.strip.empty?

        result = Prism.parse(source.to_s.strip)

        return :seeded if result.failure?

        body = result.value.statements.body

        return :seeded unless body.one?

        StateDirectives::KINDS[body.first.class.name] || :seeded
      end

      #: (untyped) -> Hash[String, StateDirectives::Declaration]
      def states_for(scope)
        scope ? @region_states.merge(@item_states[scope] || {}) : @region_states.dup
      end

      #: () -> void
      def apply_states
        @state_directives.each do |directive|
          parent = directive[:parent]
          position = parent.index(directive[:node])

          next unless position

          scope = directive[:scope]
          bucket = scope ? (@item_states[scope] || {}) : @region_states
          assignments = bucket.values.map { |declaration| state_assignment(declaration) }.join("; ")

          parent[position] = erb_code_node(assignments)
        end

        return if @region_states.empty? && @item_states.empty?

        classify_state_conditionals
        check_state_value_reads
      end

      #: (StateDirectives::Declaration) -> String
      def state_assignment(declaration)
        return "#{declaration.name} = !!(#{declaration.default})" if declaration.kind == :boolean

        "#{declaration.name} = #{declaration.default}"
      end

      #: () -> void
      def classify_state_conditionals
        @slot_nodes.each do |node|
          index = @indices[node]

          next unless index && @slots[index].type == :conditional

          scope, = @slot_scopes[node]
          states = states_for(scope)

          next if states.empty?

          info = state_conditional_for(node, states)

          @state_conditionals[node] = info if info
        end
      end

      #: (untyped, Hash[String, StateDirectives::Declaration]) -> Hash[Symbol, untyped]?
      def state_conditional_for(node, states)
        return state_case_for(node, states) if node.is_a?(Herb::AST::ERBCaseNode)

        refuse_state_unless(node, states) if node.is_a?(Herb::AST::ERBUnlessNode)

        return nil unless node.is_a?(Herb::AST::ERBIfNode)

        chain = conditional_chain(node)
        else_position = chain.index { |arm| arm.is_a?(Herb::AST::ERBElseNode) }
        conditions = else_position ? chain.take(else_position) : chain

        arms = [] #: Array[[String, String?, Integer]]

        conditions.each_with_index do |arm, branch|
          expression = condition_expression(arm)
          read = StateDirectives.condition_read(expression, states)

          if read == :computed
            raise Herb::Engine::CompilationError,
                  "`#{expression}` computes with a state; the client cannot evaluate Ruby, so a state is read bare, " \
                  "as a predicate, or compared to a literal"
          end

          unless read.is_a?(StateDirectives::Read)
            return nil if arms.empty?

            raise Herb::Engine::CompilationError,
                  "`#{expression}` sits in a state-driven conditional but reads no state; the client resolves every " \
                  "arm, so each one has to read a state"
          end

          rewrite_predicate(arm, read.name)
          arms << [read.name, read.comparand, branch]
        end

        return nil if arms.empty?

        { arms: arms, else: else_position }
      end

      #: (untyped, Hash[String, StateDirectives::Declaration]) -> void
      def refuse_state_unless(node, states)
        expression = condition_expression(node)
        read = StateDirectives.condition_read(expression, states)

        return if read.nil?

        raise Herb::Engine::CompilationError,
              "`unless #{expression}` reads a state; spell it as an `if` so the arms map to branches the client can name"
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

      #: (untyped, Hash[String, StateDirectives::Declaration]) -> Hash[Symbol, untyped]?
      def state_case_for(node, states)
        subject_source = condition_expression(node)
        read = StateDirectives.condition_read(subject_source, states)

        return nil if read.nil?

        unless read.is_a?(StateDirectives::Read) && read.comparand.nil?
          raise Herb::Engine::CompilationError,
                "`case #{subject_source}` must switch on a bare state read"
        end

        rewrite_predicate(node, read.name)

        declaration = states.fetch(read.name)
        arms = [] #: Array[[String, String?, Integer]]

        node.conditions.each_with_index do |arm, branch|
          list = condition_expression(arm)
          comparands = StateDirectives.when_comparands(list, declaration)

          if comparands == :computed
            raise Herb::Engine::CompilationError,
                  "`when #{list}` on the state `#{read.name}` has a comparand that is not a literal; the client " \
                  "resolves a `when` by lookup, so every comparand has to be one"
          end

          if comparands == :mismatched
            raise Herb::Engine::CompilationError,
                  "`when #{list}` compares the #{declaration.kind.to_s.capitalize} state `#{read.name}` against a " \
                  "literal of another type"
          end

          next unless comparands.is_a?(Array)

          comparands.each { |comparand| arms << [read.name, comparand, branch] }
        end

        else_branch = node.else_clause ? node.conditions.size : nil

        { arms: arms, else: else_branch }
      end

      #: (untyped) -> String
      def condition_expression(node)
        source = node.content&.value.to_s.strip
        keyword = source[/\A[a-z]+/]

        STATE_KEYWORDS.key?(keyword.to_s) ? source.delete_prefix(keyword.to_s).strip : source
      end

      #: (untyped, String) -> void
      def rewrite_predicate(node, name)
        token = predicate_token_for(node)

        return unless token

        token.value.gsub!(/(?<![\w?!])#{Regexp.escape(name)}\?(?![\w?!])/) { name }
      rescue FrozenError
        nil
      end

      #: (untyped) -> untyped
      def predicate_token_for(node)
        content = node.content if node.respond_to?(:content)

        return content if content.is_a?(Herb::Token)
        return nil unless node.respond_to?(:value)

        outputs = (node.value&.children || []).grep(Herb::AST::ERBContentNode)

        outputs.one? ? outputs.fetch(0).content : nil
      end

      #: (untyped, Hash[String, StateDirectives::Declaration]) -> void
      def check_interpolated_state_read(node, states)
        return unless node.respond_to?(:value)

        outputs = (node.value&.children || []).grep(Herb::AST::ERBContentNode)
        read = outputs.map { |output| output.content&.value.to_s.strip }.find { |expression| StateDirectives.mentions_any?(expression, states) }

        return unless read

        raise Herb::Engine::CompilationError,
              "`#{read}` reads a state inside an interpolated attribute; a state write cannot rebuild the mixed value, so give the state its own attribute or compute the whole value in one output tag"
      end

      #: () -> void
      def check_state_value_reads
        @slot_nodes.each do |node|
          index = @indices[node]

          next unless index

          slot = @slots[index]

          next unless [:child, :attribute, :attribute_interpolation, :boolean_attribute, :element, :raw_text].include?(slot.type)

          scope, = @slot_scopes[node]
          states = states_for(scope)

          next if states.empty?

          if slot.type == :attribute_interpolation
            check_interpolated_state_read(node, states)
            next
          end

          expression = slot.expression.to_s.strip
          expression = predicate_token_for(node)&.value.to_s.strip if expression.empty?

          next if expression.empty?
          next unless StateDirectives.mentions_any?(expression, states)

          next if convert_boolean_attribute(node, index, slot, expression, states)

          bare = states.key?(expression) || states.key?(expression.delete_suffix("?"))

          unless bare
            raise Herb::Engine::CompilationError,
                  "`#{expression}` computes with a state; the client cannot evaluate Ruby, so a state is read bare, " \
                  "compared to a literal inside a conditional, or compared to a literal in a boolean attribute"
          end

          rewrite_predicate(node, expression.delete_suffix("?")) if expression.end_with?("?")
        end
      end

      #: (untyped, Integer, untyped, String, Hash[String, StateDirectives::Declaration]) -> StateDirectives::Read?
      def convert_boolean_attribute(node, index, slot, expression, states)
        return nil unless slot.type == :attribute
        return nil unless slot.attribute && Herb::HTML::Util.boolean_attribute?(slot.attribute)

        read = StateDirectives.condition_read(expression, states)

        return nil unless read.is_a?(StateDirectives::Read)

        open_tag = @attribute_open_tags[node]
        children = open_tag&.children
        position = children&.find_index { |child| child.equal?(node) }

        return nil unless position

        condition = read.comparand ? "#{read.name} == #{read.comparand}" : read.name
        replacement = erb_output_node(%[("#{slot.attribute}" if #{condition})])

        children[position] = replacement

        @slots[index] = slot.with(type: :boolean_attribute)
        @indices[replacement] = index
        @state_presence[index] = read
      end

      #: (untyped, untyped, Integer, untyped, Integer) -> void
      def record_named_element(node, name_attribute, base, base_scope, base_depth)
        name = static_attribute_value(name_attribute)

        unless name && !name.empty?
          raise Herb::Engine::CompilationError,
                "`#{NAME_ATTRIBUTE}` on `<#{node.tag_name&.value}>` must be a static, non-empty value; " \
                "a slot name is an address, so it cannot be computed"
        end

        candidates = @slot_nodes[base..].to_a.select { |slot_node|
          scope, depth = @slot_scopes[slot_node]
          scope.equal?(base_scope) && depth == base_depth &&
            NAMEABLE_TYPES.include?(@slots[@indices[slot_node]].type)
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
          raise Herb::Engine::CompilationError,
                "two slots in the same scope are both named `#{name}`; a slot name is an address, so it has to be unique"
        end

        if attribute_conflict?(name, index, named[:scope])
          raise Herb::Engine::CompilationError,
                "the name `#{name}` collides with the `#{name}` attribute slot in the same scope; " \
                "an attribute slot is already addressable by its attribute"
        end

        scope_names[name] = index
        @slots[index] = @slots[index].with(name: name)

        rewrite_name_attribute(named, index) if @mark
      end

      #: (Hash[Symbol, untyped]) -> Integer
      def resolve_named_slot(named)
        name = named[:name]
        tag = named[:node].tag_name&.value
        candidates = named[:candidates].map { |slot_node| @indices[slot_node] }.compact.uniq

        if candidates.empty?
          raise Herb::Engine::CompilationError,
                "`#{NAME_ATTRIBUTE}=\"#{name}\"` on `<#{tag}>` names no slot; the element holds nothing dynamic"
        end

        unless candidates.one?
          raise Herb::Engine::CompilationError,
                "`#{NAME_ATTRIBUTE}=\"#{name}\"` on `<#{tag}>` is ambiguous between #{candidates.size} slots; " \
                "wrap the one it should name in its own element"
        end

        candidates.fetch(0)
      end

      #: (String, Integer, untyped) -> bool
      def attribute_conflict?(name, index, scope)
        @slots.each_with_index.any? { |slot, slot_index|
          slot.attribute == name && slot_index != index &&
            @slot_scopes[@slot_nodes[slot_index]]&.fetch(0).equal?(scope)
        }
      end

      #: (Hash[Symbol, untyped], Integer) -> void
      def rewrite_name_attribute(named, index)
        open_tag = named[:open_tag]
        return unless open_tag.respond_to?(:children)

        open_tag.children.delete(named[:attribute])
        open_tag.children << attribute_node(NAME_ATTRIBUTE, "#{index}:#{named[:name]}")
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

        return nil unless children.one?

        child = children.first

        return nil unless child.is_a?(Herb::AST::ERBContentNode)

        child.content&.value&.strip
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

        always = @state_conditionals.key?(node)

        branch_bodies(node).each_with_index do |body, branch_index|
          body.unshift(text_node(@markers.branch(slot_index, branch_index)))

          park_branch("#{slot_index}:#{branch_index}", body, always: always)
        end
      end

      #: (String, Array[untyped]) -> void
      #: (String, Array[untyped], ?always: bool) -> void
      def park_branch(key, body, always: false)
        statics = @statics
        return unless statics

        markup = SlotStatics.new(@pending).markup(body)
        return unless markup

        statics[key] = markup

        body.insert(1, erb_code_node(%(#{COVERED}["#{key}"] = true))) unless always
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
      def wrap_items(node, slot_index)
        return unless slot_index

        slot = @slots[slot_index]
        return unless slot.type == :collection && slot.key_expression

        BRANCH_BODY_PROPERTIES.each do |property|
          next unless node.respond_to?(property)

          body = node.send(property)
          next unless body.is_a?(Array) && !body.empty?

          park_item(slot_index, body)

          body.unshift(
            text_node(@markers.item_open_prefix(slot_index)),
            erb_output_node(slot.key_expression),
            text_node(@markers.item_open_suffix)
          )

          body.push(text_node(@markers.item_close(slot_index)))
        end
      end

      #: () -> void
      def park_attribute_parts
        statics = @statics
        return unless statics

        @interpolated_attributes.each do |node|
          index = @indices[node]
          next unless index

          segments = attribute_segments(node)
          next unless segments

          statics["#{index}:parts"] = @markers.branch(index, "parts") + segments.join(PART_MARKER)
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
            return nil unless erb_output?(child.tag_opening&.value.to_s)

            segments << +""
          else
            return nil
          end
        end

        segments.size > 1 ? segments : nil
      end

      def park_item(slot_index, body)
        statics = @statics
        return unless statics

        markup = SlotStatics.new(@pending).markup(body)
        return unless markup

        key = "#{slot_index}:#{ITEM_STATICS}"

        statics[key] = [
          @markers.branch(slot_index, ITEM_STATICS),
          @markers.item_open_prefix(slot_index),
          @markers.item_open_suffix,
          markup,
          @markers.item_close(slot_index)
        ].join
      end

      def anchor_attributes(node, content_index = nil)
        return unless node.is_a?(Herb::AST::HTMLElementNode)

        open_tag = node.open_tag
        return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

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
        document_node.children.unshift(
          erb_code_node("#{OCCURRENCE} = #{occurrence_expression}"),
          *region_open
        )

        document_node.children.push(comment_node(@markers.region_close(identifier)))
      end

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
