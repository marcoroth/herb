# frozen_string_literal: true

require_relative "state_directives"

module Herb
  class Engine
    # Compiles the `herb:state` directives a template declares.
    #
    # A directive names states with their defaults. This turns them into assignments the template
    # runs, classifies the conditionals and boolean attributes that read them, folds the counts
    # that count over a collection, and builds the tables a page needs to resolve any of it for
    # itself. It knows nothing about markers; it asks the visitor which slot a node is.
    class StateCompiler
      STATE_KEYWORDS = {
        "if" => :if, "elsif" => :elsif, "unless" => :unless, "case" => :case, "when" => :when,
      }.freeze #: Hash[String, Symbol]

      SEEDS_LOCAL = "_herb_seeds" #: String

      attr_reader :state_presence #: Hash[Integer, untyped]

      #: (untyped) -> void
      def initialize(visitor)
        @visitor = visitor
        @strict_locals = {} #: Hash[String, Symbol]
        @region_states = {} #: Hash[String, StateDirectives::Declaration]
        item_states = {} #: Hash[untyped, Hash[String, StateDirectives::Declaration]]
        @item_states = item_states.compare_by_identity
        @state_directives = [] #: Array[Hash[Symbol, untyped]]
        state_conditionals = {} #: Hash[untyped, Hash[Symbol, untyped]]
        @state_conditionals = state_conditionals.compare_by_identity
        state_signatures = {} #: Hash[untyped, String]
        @state_signatures = state_signatures.compare_by_identity
        @state_counts = [] #: Array[Hash[Symbol, untyped]]
        @state_presence = {} #: Hash[Integer, untyped]
      end

      #: () -> bool
      def any?
        !(@region_states.empty? && @item_states.empty?)
      end

      #: (untyped) -> bool
      def always_taken?(node)
        @state_conditionals.key?(node)
      end

      # What every count contributes to a template's version, which is what it counts and when,
      # and never how any of it is spelled on the wire.
      #: () -> Array[String]
      def count_signatures
        @state_counts.filter_map { |count|
          index = @visitor.index_for(count[:collection])

          next unless index

          [count[:name], index, count[:by], count[:when] && StateDirectives.condition_source(count[:when])].inspect
        }
      end

      #: (String, String?) -> void
      def declare_local(name, source)
        @strict_locals[name] = local_kind(source)
      end

      #: () -> Array[Hash[Symbol, untyped]]
      def state_count_entries
        @state_counts.filter_map { |count|
          index = @visitor.index_for(count[:collection])

          next unless index

          read = count[:when]

          {
            name: count[:name],
            collection: index,
            by: count[:by],
            when: read ? StateDirectives.condition_entry(read) : nil,
          }
        }
      end

      #: () -> Hash[Symbol, untyped]
      def state_declarations
        items = {} #: Hash[Integer, Array[Hash[Symbol, untyped]]]

        @item_states.each do |scope, declarations|
          index = @visitor.index_for(scope)

          items[index] = declarations.values.map(&:to_h) if index
        end

        { region: @region_states.values.map(&:to_h), items: items }
      end

      # The names of the seeded states declared at the top of the template, which only the server
      # can evaluate, so a payload carries them for the states the client cannot compute.
      #: () -> Array[String]
      def seeded_region_states
        @region_states.values.select { |declaration| StateDirectives.seeded?(declaration) }.map(&:name)
      end

      # The names of the seeded states declared inside a collection's item body, keyed by the
      # collection's slot index. A seeded value is a Ruby expression only the server can evaluate,
      # so a row the client builds for itself has no way to learn it from the markup.
      #: () -> Hash[Integer, Array[String]]
      def seeded_item_states
        seeded = {} #: Hash[Integer, Array[String]]

        @item_states.each do |scope, declarations|
          index = @visitor.index_for(scope)

          next unless index

          names = declarations.values.select { |declaration| StateDirectives.seeded?(declaration) }.map(&:name)

          seeded[index] = names unless names.empty?
        end

        seeded
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

      #: () -> Hash[Integer, String]
      def state_conditional_signatures
        resolved = {} #: Hash[Integer, String]

        @state_signatures.each do |node, signature|
          index = @visitor.index_for(node)

          resolved[index] = signature if index
        end

        resolved
      end

      #: () -> Hash[Integer, Hash[Symbol, untyped]]
      def state_conditional_entries
        resolved = {} #: Hash[Integer, Hash[Symbol, untyped]]

        @state_conditionals.each do |node, info|
          index = @visitor.index_for(node)

          resolved[index] = info if index
        end

        resolved
      end

      #: (untyped, Array[untyped]) -> void
      def register_state_directive(node, parent)
        signature = StateDirectives.signature_of(node)

        return unless signature

        scope = @visitor.current_collection
        declared = StateDirectives.parse(signature, @strict_locals, enclosing: scope ? @region_states : {})
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

        @state_directives << { node: node, parent: parent, scope: scope, inline: @visitor.inline? }
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
          seeds = directive[:inline] ? nil : seeds_marker(bucket.values)

          parent[position] = @visitor.erb_code_node(seeds ? "#{assignments}; #{seeds}" : assignments)
        end

        return if @region_states.empty? && @item_states.empty?

        classify_state_conditionals
        check_state_value_reads
        check_state_count_reads
      end

      #: (Array[StateDirectives::Declaration]) -> String?
      def seeds_marker(declarations)
        return nil unless @visitor.marking?

        seeded = declarations.select { |declaration| StateDirectives.seeded?(declaration) }

        return nil if seeded.empty?

        pairs = seeded.map { |declaration| "#{declaration.name.inspect} => #{declaration.name}" }.join(", ")

        "#{SEEDS_LOCAL} = #{SlotMarkers.seeds_expression(pairs)}; " \
          "#{@visitor.bufvar} << ::Herb::Engine.raw(#{@visitor.markers.seeds_open_prefix.inspect} + ::JSON.generate(#{SEEDS_LOCAL}).gsub(\"--\", \"-\\\\u002d\") + #{@visitor.markers.seeds_open_suffix.inspect})"
      end

      #: (StateDirectives::Declaration) -> String
      def state_assignment(declaration)
        source = declaration.default

        if declaration.derived
          StateDirectives.read_names(declaration.derived).each do |name|
            source = source.gsub(/(?<![\w?!])#{Regexp.escape(name)}\?(?![\w?!])/) { name }
          end
        end

        return "#{declaration.name} = !!(#{source})" if declaration.kind == :boolean

        "#{declaration.name} = #{source}"
      end

      #: () -> void
      def classify_state_conditionals
        @visitor.slot_nodes.each do |node|
          index = @visitor.index_for(node)

          next unless index && @visitor.slots[index].type == :conditional

          scope, = @visitor.scope_of(node)
          states = states_for(scope)

          next if states.empty?

          info = state_conditional_for(node, states)

          next unless info

          @state_signatures[node] = info.delete(:signature)
          @state_conditionals[node] = info
        end
      end

      #: (untyped, Hash[String, StateDirectives::Declaration]) -> Hash[Symbol, untyped]?
      def state_conditional_for(node, states)
        return state_case_for(node, states) if node.is_a?(Herb::AST::ERBCaseNode)
        return state_unless_for(node, states) if node.is_a?(Herb::AST::ERBUnlessNode)

        return nil unless node.is_a?(Herb::AST::ERBIfNode)

        chain = @visitor.conditional_chain(node)
        else_position = chain.index { |arm| arm.is_a?(Herb::AST::ERBElseNode) }
        conditions = else_position ? chain.take(else_position) : chain

        arms = [] #: Array[untyped]
        sources = [] #: Array[String]

        conditions.each_with_index do |arm, branch|
          expression = condition_expression(arm)
          read = StateDirectives.condition_read(expression, states)

          if read == :computed
            raise Herb::Engine::CompilationError,
                  "`#{expression}` computes with a state; the client cannot evaluate Ruby, so a state is read bare, " \
                  "as a predicate, or compared to a literal"
          end

          unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)
            return nil if arms.empty?

            raise Herb::Engine::CompilationError,
                  "`#{expression}` sits in a state-driven conditional but reads no state; the client resolves every " \
                  "arm, so each one has to read a state"
          end

          StateDirectives.read_names(read).each { |name| rewrite_predicate(arm, name) }

          arms << arm_entry(read, branch)
          sources << "#{StateDirectives.condition_source(read)}@#{branch}"
        end

        return nil if arms.empty?

        { arms: arms, else: else_position, signature: signature_of(sources, else_position) }
      end

      #: (Array[String], Integer?) -> String
      def signature_of(sources, else_position)
        (sources + ["else@#{else_position}"]).join("|")
      end

      #: (untyped, Integer?) -> Hash[String, untyped]
      def arm_entry(read, branch)
        { "branch" => branch, "condition" => StateDirectives.condition_entry(read) }
      end

      #: (untyped, Hash[String, StateDirectives::Declaration]) -> Hash[Symbol, untyped]?
      def state_unless_for(node, states)
        expression = condition_expression(node)
        read = StateDirectives.condition_read(expression, states)

        return nil if read.nil?

        if read == :computed
          raise Herb::Engine::CompilationError,
                "`unless #{expression}` computes with a state; the client cannot evaluate Ruby, so a state is read " \
                "bare, as a predicate, or compared to a literal"
        end

        return nil unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)

        chain = @visitor.conditional_chain(node)
        else_position = chain.index { |arm| arm.is_a?(Herb::AST::ERBElseNode) }

        StateDirectives.read_names(read).each { |name| rewrite_predicate(node, name) }

        {
          arms: [arm_entry(read, else_position)],
          else: 0,
          signature: signature_of(["!#{StateDirectives.condition_source(read)}@#{else_position}"], 0),
        }
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
        arms = [] #: Array[untyped]
        sources = [] #: Array[String]

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

          comparands.each do |comparand|
            arms << { "branch" => branch, "condition" => [read.name, { "value" => StateDirectives.literal_value(comparand) }] }
            sources << "#{read.name}==#{comparand}@#{branch}"
          end
        end

        else_branch = node.else_clause ? node.conditions.size : nil

        { arms: arms, else: else_branch, signature: signature_of(sources, else_branch) }
      end

      #: (untyped) -> String
      def condition_expression(node)
        source = node.content&.value.to_s.strip
        keyword = source[/\A[a-z]+/]

        STATE_KEYWORDS.key?(keyword.to_s) ? source.delete_prefix(keyword.to_s).strip : source
      end

      #: (untyped) -> untyped
      def register_count_fold(node)
        return nil if @visitor.continuation?(node)
        return nil unless node.respond_to?(:subsequent) && node.subsequent.nil?
        return nil unless @visitor.in_item_body?

        scope = @visitor.current_collection

        return nil unless scope

        states = states_for(scope)

        return nil if states.empty?

        body = node.respond_to?(:statements) ? node.statements : nil #: untyped

        return nil unless body.is_a?(Array)

        significant = body.reject { |child| @visitor.blank_child?(child) }

        return nil unless significant.one?

        assignment = significant.first

        return nil unless assignment.is_a?(Herb::AST::ERBContentNode) && assignment.tag_opening&.value == "<%"

        increment = StateDirectives.fold_increment(assignment.content&.value.to_s)

        return nil unless increment && states.key?(increment.name)

        read = StateDirectives.condition_read(condition_expression(node), states)

        return nil unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)

        register_count(increment, when_read: read)
        StateDirectives.read_names(read).each { |name| rewrite_predicate(node, name) }

        node
      end

      #: (untyped) -> void
      def check_state_assignment(node)
        return unless node.is_a?(Herb::AST::ERBContentNode)

        tag = node.tag_opening&.value

        return unless ["<%", "<%=", "<%=="].include?(tag)

        scope = @visitor.current_collection
        states = states_for(scope)

        return if states.empty?

        content = node.content&.value.to_s
        assigned = StateDirectives.assigned_state_names(content, states)

        return if assigned.empty?

        if tag == "<%" && scope && @visitor.in_item_body?
          increment = StateDirectives.fold_increment(content)

          if increment && assigned == [increment.name]
            register_count(increment, when_read: nil)

            return
          end
        end

        raise Herb::Engine::CompilationError,
              "`#{content.strip}` assigns the state `#{assigned.first}`; the client never sees a server-side " \
              "write, so seed the initial value in the declaration, derive it from other states, count items " \
              "with `#{assigned.first} += 1` behind a state condition in a keyed loop, or write it at runtime " \
              "with `data-herb-set` or `state.set`"
      end

      #: (StateDirectives::FoldIncrement, when_read: untyped) -> void
      def register_count(increment, when_read:)
        name = increment.name
        declaration = @region_states[name]

        unless declaration
          raise Herb::Engine::CompilationError,
                "`#{name} += #{increment.by}` counts into `#{name}`, which is an item state; a count lives once " \
                "per region, so declare `#{name}` at the top of the template"
        end

        if declaration.derived
          raise Herb::Engine::CompilationError,
                "`#{name} += #{increment.by}` counts into `#{name}`, which is derived from " \
                "`#{declaration.default}`; a state is either derived or counted, so drop one of the two"
        end

        unless declaration.kind == :integer
          raise Herb::Engine::CompilationError,
                "`#{name} += #{increment.by}` counts into the #{declaration.kind.to_s.capitalize} state " \
                "`#{name}`; a count is a number, so declare it as an Integer, like `(#{name}: 0)`"
        end

        if @state_counts.any? { |count| count[:name] == name }
          raise Herb::Engine::CompilationError,
                "`#{name}` is counted twice; one state holds one count, so declare a second state for the " \
                "second count"
        end

        if @visitor.slots.any? { |slot| StateDirectives.mentions_any?(slot.expression.to_s, { name => declaration }) }
          raise Herb::Engine::CompilationError,
                "`#{name}` is read before its count is complete; the server renders that read mid-count and " \
                "the client cannot keep it current there, so move the read after the loop"
        end

        @state_counts << { name: name, by: increment.by, collection: @visitor.current_collection, when: when_read }
      end

      #: () -> void
      def check_state_count_reads
        @state_counts.each do |count|
          @visitor.slot_nodes.each do |node|
            index = @visitor.index_for(node)

            next unless index

            scope, = @visitor.scope_of(node)

            next unless scope.equal?(count[:collection])

            expression = @visitor.slots[index].expression.to_s

            next if expression.strip.empty?

            mentioned = {} #: Hash[String, untyped]
            mentioned[count[:name]] = true

            next unless StateDirectives.mentions_any?(expression, mentioned)

            raise Herb::Engine::CompilationError,
                  "`#{count[:name]}` is read inside the loop that counts it; the count is complete only after " \
                  "the loop, so move the read below it"
          end
        end
      end

      #: (untyped, String) -> void
      def rewrite_predicate(node, name)
        return if rewrite_literal_predicate(node, name)

        token = predicate_token_for(node)

        return unless token

        token.value.gsub!(/(?<![\w?!])#{Regexp.escape(name)}\?(?![\w?!])/) { name }
      rescue FrozenError
        nil
      end

      #: (untyped, String) -> untyped
      def rewrite_literal_predicate(node, name)
        return nil unless node.is_a?(Herb::AST::HTMLAttributeNode)

        children = node.value&.children

        return nil unless children.is_a?(Array)

        position = children.index { |child| child.is_a?(Herb::AST::RubyLiteralNode) }

        return nil unless position

        literal = children.fetch(position) #: untyped
        rewritten = literal.content.to_s.gsub(/(?<![\w?!])#{Regexp.escape(name)}\?(?![\w?!])/) { name }
        replacement = Herb::AST::RubyLiteralNode.build(content: rewritten, location: literal.location)

        children[position] = replacement

        replacement
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
              "`#{read}` reads a state inside an interpolated attribute that mixes other dynamic parts; a state " \
              "write cannot supply the other values, so give the state its own attribute or its own output"
      end

      #: () -> void
      def check_state_value_reads
        @visitor.slot_nodes.each do |node|
          index = @visitor.index_for(node)

          next unless index

          slot = @visitor.slots[index]

          next unless [:child, :attribute, :attribute_interpolation, :boolean_attribute, :element, :raw_text].include?(slot.type)

          scope, = @visitor.scope_of(node)
          states = states_for(scope)

          next if states.empty?

          if slot.type == :attribute_interpolation && slot.expression.to_s.strip.empty?
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

      #: (untyped, Integer, untyped, String, Hash[String, StateDirectives::Declaration]) -> untyped
      def convert_boolean_attribute(node, index, slot, expression, states)
        return nil unless slot.type == :attribute || (slot.type == :boolean_attribute && !@state_presence.key?(index))
        return nil unless slot.attribute && Herb::HTML::Util.boolean_attribute?(slot.attribute)

        read = StateDirectives.condition_read(expression, states)

        return nil unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)

        if read.is_a?(StateDirectives::Read) && read.comparand.nil? && read.against.nil? && ![:boolean, :nil, :seeded].include?(read.kind)
          raise Herb::Engine::CompilationError,
                "`#{slot.attribute}=\"<%= #{expression} %>\"` reads the #{read.kind.to_s.capitalize} state `#{read.name}` " \
                "as a presence; only `nil` and `false` are falsy in Ruby, so the attribute could never turn off. " \
                "Compare the state to a literal, or declare it as a boolean"
        end

        open_tag = @visitor.open_tag_for(node)
        children = open_tag&.children
        position = children&.find_index { |child| child.equal?(node) }

        return nil unless position

        condition = StateDirectives.condition_source(read)
        spacing = open_tag.is_a?(Herb::AST::ERBOpenTagNode) ? " " : ""
        replacement = @visitor.erb_output_node(%[("#{spacing}#{slot.attribute}" if #{condition})])

        children[position] = replacement

        @visitor.replace_slot(index, slot.with(type: :boolean_attribute))
        @visitor.assign_index(replacement, index)
        @state_presence[index] = read
      end
    end
  end
end
