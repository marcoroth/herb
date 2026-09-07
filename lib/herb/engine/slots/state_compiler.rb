# frozen_string_literal: true

require "did_you_mean"

require_relative "state_directives"
require_relative "state_overrides"

module Herb
  class Engine
    module Slots
      # Compiles the `herb:state` directives a template declares.
      #
      # A directive names states with their defaults. This turns them into assignments the template
      # runs, classifies the conditionals and boolean attributes that read them, folds the counts
      # that count over a collection, and builds the tables a page needs to resolve any of it for
      # itself. It knows nothing about markers; it asks the visitor which slot a node is.
      #
      class StateCompiler
        STATE_KEYWORDS = {
          "if" => :if,
          "elsif" => :elsif,
          "unless" => :unless,
          "case" => :case,
          "when" => :when,
        }.freeze #: Hash[String, Symbol]

        SEEDS_LOCAL = "_herb_seeds" #: String
        OVERRIDES_LOCAL = "_herb_state_overrides" #: String
        BARE_IDENTIFIER = /\A[a-z_][a-zA-Z0-9_]*\z/ #: Regexp
        BINDABLE_ATTRIBUTES = ["value", "checked", "selected"].freeze #: Array[String]
        BINDABLE_ELEMENTS = ["input", "textarea", "select", "option"].freeze #: Array[String]

        attr_reader :state_presence #: Hash[Integer, untyped]
        attr_reader :state_values #: Hash[Integer, untyped]

        #: (untyped) -> void
        def initialize(visitor)
          @visitor = visitor
          @strict_locals = {} #: Hash[String, Symbol]
          @near_missed = Set.new #: Set[Integer]
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
          @state_values = {} #: Hash[Integer, untyped]
          @server_reads = {} #: Hash[String, Array[Hash[String, untyped]]]
          @internal_states = {} #: Hash[String, StateDirectives::Declaration]
        end

        #: () -> bool
        def any?
          !(@region_states.empty? && @item_states.empty? && @internal_states.empty?)
        end

        #: () -> String
        def declare_internal_block
          name = "_herb_block_#{@internal_states.size}"

          @internal_states[name] = StateDirectives::Declaration.new(name: name, kind: :boolean, default: "false", derived: nil, line: nil, column: nil)

          name
        end

        #: (String) -> String
        def internal_assignment(name)
          declaration = @internal_states.fetch(name)
          assignment = state_assignment(declaration)

          @visitor.state_overrides? ? "#{overrides_prelude}; #{assignment}" : assignment
        end

        #: () -> Array[String]
        def count_signatures
          @state_counts.filter_map { |count|
            index = @visitor.index_for(count[:collection])

            next unless index

            [count[:name], index, count[:by], count[:when] && StateDirectives.condition_source(count[:when])].inspect
          }
        end

        #: () -> Hash[String, untyped]?
        def manifest
          declared = state_declarations
          names = declared[:region].map { |declaration| declaration[:name] } + declared[:items].values.flatten.map { |declaration| declaration[:name] } + @internal_states.keys

          return nil if names.empty?

          reads = {} #: Hash[String, Array[Integer]]
          declarations = declared[:region].map { |declaration| declared_entry(declaration, "region") } + declared[:items].flat_map { |index, list| list.map { |declaration| declared_entry(declaration, index) } }

          declarations += @internal_states.values.map { |declaration| declared_entry(declaration.to_h, "region").merge("internal" => true) }

          @visitor.slots.each do |slot|
            next unless slot.valued?

            name = slot.expression.to_s.strip.delete_suffix("?")

            unless names.include?(name)
              warn_near_miss(slot, name, names)

              next
            end

            scope_and_depth = @visitor.scope_of(@visitor.slot_nodes[slot.index])

            next if scope_and_depth && @visitor.block_locals(scope_and_depth[0]).include?(name)

            (reads[name] ||= []) << slot.index

            warn_unbindable(slot, name) if slot.interpolated?
          end

          presence = {} #: Hash[String, untyped]

          state_presence.each do |index, read|
            presence[index.to_s] = StateDirectives.condition_entry(read)
            StateDirectives.read_names(read).each { |name| (reads[name] ||= []) << index }

            warn_computed_presence(index, read)
          end

          computed = {} #: Hash[String, untyped]

          state_values.each do |index, read|
            computed[index.to_s] = StateDirectives.condition_entry(read)
            StateDirectives.read_names(read).each { |name| (reads[name] ||= []) << index }
          end

          conditionals = {} #: Hash[String, Hash[String, untyped]]

          state_conditional_entries.each do |index, info|
            conditionals[index.to_s] = { "arms" => info[:arms], "else" => info[:else] }
          end

          state_count_entries.each do |count|
            declaration = declarations.find { |entry| entry["name"] == count[:name] && entry["scope"] == "region" }

            next unless declaration

            declaration["count"] = { "collection" => count[:collection], "when" => count[:when], "by" => count[:by] }
          end

          {
            "version" => @visitor.version,
            "declarations" => declarations,
            "reads" => reads,
            "conditionals" => conditionals,
            "presence" => presence,
            "computed" => computed,
            "server" => { "branches" => branch_orphans(reads, computed, presence, steerable_names(declarations)), "reads" => @server_reads },
            "fragments" => fragment_entries,
          }
        end

        #: (untyped, String) -> void
        def warn_unbindable(slot, name)
          return unless bindable_shape?(slot)
          return if @visitor.listener_writes?(slot.index, [name])

          place = slot.attribute ? "`#{slot.attribute}`" : "content"

          @visitor.slot_warning(
            "`#{name}` shares this `<#{slot.tag}>`'s #{place} with other text, so typing here will not write the state back. State writes still update the whole #{place}.",
            @visitor.slot_nodes[slot.index]&.location,
            :binding,
            suggestion: "Make `#{name}` the only #{slot.attribute ? "value of `#{slot.attribute}`" : "content of the `<#{slot.tag}>`"} to bind it, or write the state from your own listener."
          )
        end

        #: (untyped) -> bool
        def bindable_shape?(slot)
          if slot.attribute
            BINDABLE_ATTRIBUTES.include?(slot.attribute) && BINDABLE_ELEMENTS.include?(slot.tag.to_s)
          else
            slot.tag == "textarea"
          end
        end

        #: (Integer, untyped) -> void
        def warn_computed_presence(index, read)
          slot = @visitor.slots[index]

          return unless slot && bindable_shape?(slot)
          return if bare_presence?(read)
          return if @visitor.listener_writes?(index, StateDirectives.read_names(read))

          @visitor.slot_warning(
            "`#{slot.attribute}` on this `<#{slot.tag}>` follows `#{StateDirectives.condition_source(read)}`, so using the control cannot write a state back. The attribute still updates when the states change.",
            @visitor.slot_nodes[index]&.location,
            :binding,
            suggestion: "Drive `#{slot.attribute}` with a single state to bind it, or write the states from your own listener."
          )
        end

        #: (untyped) -> bool
        def bare_presence?(read)
          read.is_a?(StateDirectives::Read) && read.operator.nil? && read.transform.nil? && read.comparand.nil? && read.against.nil?
        end

        #: (untyped, String, Array[String]) -> void
        def warn_near_miss(slot, name, names)
          return unless BARE_IDENTIFIER.match?(name)
          return if @strict_locals.key?(name)

          suggestions = DidYouMean::SpellChecker.new(dictionary: names).correct(name)

          return if suggestions.empty?

          @near_missed << slot.index

          @visitor.slot_warning(
            "`#{name}` reads like the state `#{suggestions.first}` but is not declared, so the server owns it and the client can never fill it.",
            @visitor.slot_nodes[slot.index]&.location,
            :unknown,
            suggestion: "Spell the state's name, or declare `#{name}` in `herb:state`."
          )
        end

        #: () -> Hash[String, untyped]
        def fragment_entries
          refetchable = @server_reads.values.flatten.to_set { |entry| entry["index"] }
          entries = {} #: Hash[String, untyped]

          @visitor.fragment_indexes.each do |index|
            inside = (@visitor.slots_by_branch(index)[0] || []).select { |slot_index| refetchable.include?(slot_index) }

            entries[index.to_s] = { "fallback" => 1, "reads" => inside }.merge(@visitor.fragment_timing_for(index)) unless inside.empty?
          end

          @visitor.deferred_entries.each do |index, info|
            inside = (@visitor.slots_by_branch(index)[0] || []).select { |slot_index| refetchable.include?(slot_index) }

            entries[index.to_s] = { "mode" => info[:mode], "state" => info[:state], "fallback" => 1, "reads" => inside }.merge(info[:timing])
          end

          entries
        end

        #: (Array[Hash[String, untyped]]) -> Set[String]
        def steerable_names(declarations)
          declarations.filter_map { |entry| entry["name"] if entry["scope"] == "region" && !entry["derived"] && !entry["count"] }.to_set
        end

        #: (untyped) -> Array[String]
        def condition_names(condition)
          if condition.is_a?(Hash)
            parts = condition["all"] || condition["any"]

            return parts.to_a.flat_map { |part| condition_names(part) }
          end

          return [] unless condition.is_a?(Array)

          names = [] #: Array[String]
          names << condition[0] if condition[0].is_a?(String)

          comparand = condition[1]
          names << comparand["state"] if comparand.is_a?(Hash) && comparand["state"].is_a?(String)

          names
        end

        #: (Hash[Symbol, untyped], Set[String]) -> bool
        def steered_conditional?(info, steerable)
          names = info[:arms].flat_map { |arm| condition_names(arm["condition"]) }

          !names.empty? && names.all? { |name| steerable.include?(name) }
        end

        #: (Integer, Hash[Symbol, untyped]) -> Set[Integer]
        def default_branch_slots(index, info)
          none = Set.new #: Set[Integer]
          node = @visitor.slot_nodes[index]

          return none unless node

          scope, = @visitor.scope_of(node)
          states = states_for(scope)

          info[:arms].each do |arm|
            verdict = static_condition(arm["condition"], states)

            return none if verdict.nil?
            next unless verdict
            return none if arm["branch"].nil?

            return branch_slot_set(index, arm.fetch("branch"))
          end

          return none if info[:else].nil?

          branch_slot_set(index, info.fetch(:else))
        end

        #: (Integer, Integer) -> Set[Integer]
        def branch_slot_set(index, branch)
          slots = @visitor.slots_by_branch(index)[branch] || [] #: Array[Integer]

          slots.to_set
        end

        #: (untyped, Hash[String, StateDirectives::Declaration]) -> bool?
        def static_condition(condition, states)
          return static_combo(condition, states) if condition.is_a?(Hash)
          return nil unless condition.is_a?(Array)
          return nil if condition[3]

          name, comparand, operator = condition
          value = static_default(name, states)

          return nil if value == :__herb_undecided

          if comparand.nil?
            case operator
            when nil then return !value.nil? && value != false
            when "blank" then return value.nil? || value == false || value == ""
            when "present" then return !(value.nil? || value == false || value == "")
            else return nil
            end
          end

          return nil unless comparand.is_a?(Hash)

          against = static_comparand(comparand, states)

          return nil if against == :__herb_undecided

          compare_statics(value, against, operator || "==")
        end

        #: (Hash[String, untyped], Hash[String, StateDirectives::Declaration]) -> untyped
        def static_comparand(comparand, states)
          return comparand["value"] if comparand.key?("value")
          return :__herb_undecided if comparand["transform"] || !comparand["state"].is_a?(String)

          static_default(comparand.fetch("state"), states)
        end

        #: (Hash[String, untyped], Hash[String, StateDirectives::Declaration]) -> bool?
        def static_combo(condition, states)
          parts = (condition["all"] || condition["any"]).to_a.map { |part| static_condition(part, states) }

          if condition.key?("all")
            return false if parts.any? { |part| part == false }
            return true if parts.all? { |part| part == true }
          else
            return true if parts.any? { |part| part == true }
            return false if parts.all? { |part| part == false }
          end

          nil
        end

        #: (String, Hash[String, StateDirectives::Declaration]) -> untyped
        def static_default(name, states)
          declaration = states[name]

          return :__herb_undecided if declaration.nil? || declaration.derived
          return :__herb_undecided if @state_counts.any? { |count| count[:name] == name }
          return :__herb_undecided unless StateDirectives.literal?(declaration.default)

          StateDirectives.literal_value(declaration.default)
        end

        #: (untyped, untyped, String) -> bool?
        def compare_statics(value, against, operator)
          case operator
          when "==" then value == against
          when "!=" then value != against
          when ">", ">=", "<", "<="
            return nil unless value.is_a?(Integer) && against.is_a?(Integer)

            value.public_send(operator, against)
          end
        end

        #: (Hash[String, Array[Integer]], Hash[String, untyped], Hash[String, untyped], Set[String]) -> void
        def branch_orphans(reads, computed, presence, steerable)
          branches = {} #: Hash[String, Array[Hash[String, untyped]]]

          return branches unless @visitor.client?

          covered = (reads.values.flatten + computed.keys.map(&:to_i) + presence.keys.map(&:to_i)).to_set
          refetchable = @server_reads.values.flatten.to_set { |entry| entry["index"] }
          seen = Set.new #: Set[Integer]

          state_conditional_entries.each do |index, info|
            steered = steered_conditional?(info, steerable)
            served = default_branch_slots(index, info)

            @visitor.slots_inside(index).each do |inside|
              next unless seen.add?(inside)

              slot = @visitor.slots[inside]

              next unless slot
              next unless slot.valued? || refetchable.include?(inside)
              next if covered.include?(inside)
              next if @near_missed.include?(inside)

              (branches[index.to_s] ||= []) << { "index" => inside, "node_path" => slot.node_path }

              next if steered
              next if served.include?(inside)
              next if refetchable.include?(inside)

              expression = slot.expression.to_s.strip

              @visitor.slot_warning(
                "`<%= #{expression} %>` sits inside a branch the client can show on its own, but its value comes from the server. The server only computes values for the branch it renders, so showing this branch ahead of the server leaves the value empty.",
                @visitor.slot_nodes[inside]&.location,
                :branch,
                suggestion: "Declare a state holding the value, or move `<%= #{expression} %>` out of the conditional."
              )
            end
          end

          branches
        end

        #: (Hash[Symbol, untyped], (String | Integer)) -> Hash[String, untyped]
        def declared_entry(declaration, scope)
          entry = declaration.transform_keys(&:to_s).merge("scope" => scope)
          derived = entry["derived"]

          entry["derived"] = StateDirectives.condition_entry(derived) if derived
          entry["value"] = StateDirectives.literal_value(entry["default"]) if !derived && StateDirectives.literal?(entry["default"])

          entry
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

        #: () -> Array[String]
        def seeded_region_states
          @region_states.values.select { |declaration| StateDirectives.seeded?(declaration) }.map(&:name)
        end

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
          return unless node.is_a?(Herb::AST::HerbStateDirectiveNode)

          scope = @visitor.current_collection
          declared = StateDirectives.parse(node, @strict_locals, visitor: @visitor, enclosing: scope ? @region_states : {})
          empty = {} #: Hash[String, StateDirectives::Declaration]
          bucket = scope ? (@item_states[scope] ||= empty) : @region_states

          start = node.location&.start

          declared.each do |declaration|
            spelled = declaration_location(declaration) || node.location

            if @strict_locals.key?(declaration.name)
              next @visitor.slot_error("`#{declaration.name}` is both a strict local and a state. A local comes from the caller and a state is owned by the client, so the name has two owners.", spelled, :declaration, suggestion: "Rename one of the two.")
            end

            if bucket.key?(declaration.name)
              next @visitor.slot_error("The state `#{declaration.name}` is declared twice in the same scope.", spelled, :declaration, suggestion: "Remove one of the two declarations.")
            end

            shadowed = scope ? @region_states.key?(declaration.name) : @item_states.values.any? { |declarations| declarations.key?(declaration.name) }

            if shadowed
              next @visitor.slot_error("The state `#{declaration.name}` is declared in both an item and its region, so a later read could mean either one.", spelled, :declaration, suggestion: "Give them different names, like `item_#{declaration.name}` for the one inside the loop.")
            end

            bucket[declaration.name] = declaration.line ? declaration : declaration.with(line: start&.line, column: start&.column)
          end

          @state_directives << { node: node, parent: parent, scope: scope, inline: @visitor.inline? }
        end

        #: (StateDirectives::Declaration) -> Herb::Location?
        def declaration_location(declaration)
          line = declaration.line

          return nil unless line

          column = declaration.column || 0

          Herb::Location.from(line, column, line, column + declaration.name.length)
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
          region = @region_states.merge(@internal_states)
          states = scope ? region.merge(@item_states[scope] || {}) : region
          none = [] #: Array[String]
          shadowed = scope ? @visitor.block_locals(scope) : none

          shadowed.empty? ? states : states.except(*shadowed)
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
            assignments = "#{overrides_prelude}; #{assignments}" if @visitor.state_overrides?
            seeds = directive[:inline] || @visitor.degraded? ? nil : seeds_marker(bucket.values)

            parent[position] = @visitor.record_assignment(@visitor.erb_code_node(seeds ? "; #{assignments}; #{seeds}" : "; #{assignments}"))
          end

          if @region_states.empty? && @item_states.empty? && @internal_states.empty?
            check_fragments

            return
          end

          classify_state_conditionals
          check_state_value_reads
          check_collection_reads
          check_state_count_reads
          check_fragments
          check_deferred_placement
        end

        #: () -> void
        def check_deferred_placement
          collections = @visitor.slots.select { |slot| slot.type == :collection }

          @visitor.deferred_entries.each do |index, info|
            slot = @visitor.slots[index]

            next unless slot
            next if collections.none? { |collection| slot.node_path.first(collection.node_path.length) == collection.node_path }

            @visitor.slot_error(
              "A `<#{info[:mode].capitalize}>` sits inside a collection, and a deferred block cannot stand per item yet.",
              @visitor.slot_nodes[index]&.location,
              :component,
              suggestion: "Move the block outside the loop, or defer around the whole collection."
            )
          end
        end

        #: () -> void
        def check_fragments
          refetchable = @server_reads.values.flatten.to_set { |entry| entry["index"] }

          @visitor.fragment_indexes.each do |index|
            inside = @visitor.slots_by_branch(index)[0] || []

            next if inside.any? { |slot_index| refetchable.include?(slot_index) }

            @visitor.slot_warning(
              "Nothing inside this `<Fragment>` is derived on the server, so its `<Fallback>` can never appear.",
              @visitor.slot_nodes[index]&.location,
              :component,
              suggestion: "Compute something with a declared state inside the fragment, or unwrap it."
            )
          end
        end

        #: (Array[StateDirectives::Declaration]) -> String?
        def seeds_marker(declarations)
          return nil unless @visitor.marking?

          seeded = declarations.select { |declaration| StateDirectives.seeded?(declaration) }

          return nil if seeded.empty?

          pairs = seeded.map { |declaration| "#{declaration.name.inspect} => #{declaration.name}" }.join(", ")

          "#{SEEDS_LOCAL} = #{Markers.seeds_expression(pairs)}; #{@visitor.bufvar} << ::Herb::Engine.raw(#{@visitor.markers.seeds_open_prefix.inspect} + ::JSON.generate(#{SEEDS_LOCAL}).gsub(\"--\", \"-\\\\u002d\") + #{@visitor.markers.seeds_open_suffix.inspect})"
        end

        #: (StateDirectives::Declaration) -> String
        def state_assignment(declaration)
          source = declaration.default

          if declaration.derived
            StateDirectives.read_names(declaration.derived).each do |name|
              source = StateDirectives.rewrite_reads(source, name)
            end
          end

          default = declaration.kind == :boolean ? "!!(#{source})" : source

          return "#{declaration.name} = #{default}" unless overridable?(declaration)

          "#{declaration.name} = ::Herb::Engine::Slots::StateOverrides.fetch(#{OVERRIDES_LOCAL}, #{declaration.name.inspect}, #{declaration.kind.inspect}) { #{default} }"
        end

        #: (StateDirectives::Declaration) -> bool
        def overridable?(declaration)
          return false unless @visitor.state_overrides?
          return false if declaration.derived

          @state_counts.none? { |count| count[:name] == declaration.name }
        end

        #: () -> String
        def overrides_prelude
          "#{OVERRIDES_LOCAL} = ::Herb::Engine::Slots::StateOverrides.resolve((#{StateOverrides::HOOK} if defined?(#{StateOverrides::HOOK})), #{@visitor.identifier.inspect})"
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
            read = StateDirectives.condition_read(expression, states, @visitor, condition_anchor(arm, expression), resolved_ruby(arm))

            return nil if read == :reported

            if read == :computed
              return @visitor.slot_error("`#{expression}` computes with the state `#{mentioned_state(expression, states)&.name}`. The client resolves each condition itself and cannot run Ruby to pick a branch.", condition_anchor(arm, expression).location, :read, suggestion: read_advice(mentioned_state(expression, states)))
            end

            unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)
              return nil if arms.empty?

              return @visitor.slot_error("`#{expression}` sits in a state-driven conditional but reads no state. The client resolves every arm, so an arm it cannot answer would never be chosen.", condition_anchor(arm, expression).location, :conditional, suggestion: "Read a state in this arm, or move this branch into its own conditional.")
            end

            dead = StateDirectives.never_falsy_read(read)

            return presence_error(expression, dead, states, condition_anchor(arm, expression), "true") if dead

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
          read = StateDirectives.condition_read(expression, states, @visitor, condition_anchor(node, expression), resolved_ruby(node))

          return nil if read.nil? || read == :reported

          if read == :computed
            return @visitor.slot_error("`unless #{expression}` computes with the state `#{mentioned_state(expression, states)&.name}`. The client resolves each condition itself and cannot run Ruby to pick a branch.", condition_anchor(node, expression).location, :read, suggestion: read_advice(mentioned_state(expression, states)))
          end

          return nil unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)

          dead = StateDirectives.never_falsy_read(read)

          return presence_error("unless #{expression}", dead, states, condition_anchor(node, expression), "false") if dead

          chain = @visitor.conditional_chain(node)
          else_position = chain.index { |arm| arm.is_a?(Herb::AST::ERBElseNode) }

          StateDirectives.read_names(read).each { |name| rewrite_predicate(node, name) }

          {
            arms: [arm_entry(read, else_position)],
            else: 0,
            signature: signature_of(["!#{StateDirectives.condition_source(read)}@#{else_position}"], 0),
          }
        end

        #: (String, StateDirectives::Read, Hash[String, StateDirectives::Declaration], StateAnchor, String) -> nil
        def presence_error(spelled, read, states, anchor, answer)
          declaration = states.fetch(read.name)

          @visitor.slot_error(
            "`#{spelled}` reads #{StateDirectives.subject_phrase(read)} as a presence. Only `nil` and `false` are falsy in Ruby, so the condition is always #{answer}.",
            anchor.location,
            :read,
            suggestion: "#{StateDirectives.predicate_advice(read.kind, read.name)}compare it to a literal#{StateDirectives.default_example(declaration, "#{read.name} == ")}, or declare it as a boolean."
          )
        end

        #: (untyped, Hash[String, StateDirectives::Declaration]) -> Hash[Symbol, untyped]?
        def state_case_for(node, states)
          subject_source = condition_expression(node)
          read = StateDirectives.condition_read(subject_source, states, @visitor, condition_anchor(node, subject_source), resolved_ruby(node))

          return nil if read.nil? || read == :reported

          unless read.is_a?(StateDirectives::Read) && read.comparand.nil? && read.operator.nil? && read.transform.nil?
            return @visitor.slot_error("`case #{subject_source}` switches on something other than a bare state read. The client resolves a `case` by looking the state up.", condition_anchor(node, subject_source).location, :conditional, suggestion: "Switch on the state itself, like `case #{mentioned_state(subject_source, states)&.name}`.")
          end

          rewrite_predicate(node, read.name)

          declaration = states.fetch(read.name)
          arms = [] #: Array[untyped]
          sources = [] #: Array[String]

          node.conditions.each_with_index do |arm, branch|
            list = condition_expression(arm)
            comparands = StateDirectives.when_comparands(list, declaration)

            if comparands == :computed
              return @visitor.slot_error("`when #{list}` on the state `#{read.name}` has a comparand that is not a literal. The client resolves a `when` by lookup.", condition_anchor(arm, list).location, :conditional, suggestion: "List literals instead#{StateDirectives.default_example(declaration, "when ")}.")
            end

            if comparands == :mismatched
              return @visitor.slot_error("`when #{list}` compares the #{declaration.kind.to_s.capitalize} state `#{read.name}` against a literal of another type, so it can never match.", condition_anchor(arm, list).location, :compare, suggestion: "Use #{StateDirectives.kind_article(declaration.kind)} literal in every arm#{StateDirectives.default_example(declaration, "when ")}.")
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

        #: (String, Hash[String, StateDirectives::Declaration]) -> StateDirectives::Declaration?
        def mentioned_state(expression, states)
          states.each_value.find { |declaration| StateDirectives.mentions_any?(expression, { declaration.name => declaration }) }
        end

        #: (StateDirectives::Declaration?) -> String
        def read_advice(declaration)
          return "Read the state bare, or compare it to a literal." unless declaration

          name = declaration.name

          return "Read `#{name}` bare, like `<% if #{name} %>`, or as `#{name}?`." if declaration.kind == :boolean

          "Read `#{name}` bare, like `<% if #{name} %>`, or compare it to a literal#{StateDirectives.default_example(declaration, "#{name} == ")}."
        end

        #: (untyped, String) -> StateAnchor
        def condition_anchor(node, expression)
          content = node.content if node.respond_to?(:content)

          return StateAnchor.new(node.location) unless content.is_a?(Herb::Token)

          StateAnchor.new(content.location, token: content, expression: expression)
        end

        #: (untyped) -> String
        def condition_expression(node)
          source = node.content&.value.to_s.strip
          keyword = source[/\A[a-z]+/]

          STATE_KEYWORDS.key?(keyword.to_s) ? source.delete_prefix(keyword.to_s).strip : source
        end

        #: (untyped) -> untyped
        def resolved_ruby(node)
          @visitor.ruby_at(node.content&.location) if node.respond_to?(:content) && node.content.is_a?(Herb::Token)
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

          read = StateDirectives.condition_read(condition_expression(node), states, @visitor, condition_anchor(node, condition_expression(node)), resolved_ruby(node))

          return nil unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)

          register_count(increment, when_read: read, location: node.location)
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
          assigned = StateDirectives.assigned_state_names(content, states) - @internal_states.keys

          return if assigned.empty?

          if tag == "<%" && scope && @visitor.in_item_body?
            increment = StateDirectives.fold_increment(content)

            if increment && assigned == [increment.name]
              register_count(increment, when_read: nil, location: node.location)

              return
            end
          end

          @visitor.slot_error("`#{content.strip}` assigns the state `#{assigned.first}`. The client never sees a server-side write, so the value it holds would drift from the one the server rendered.", node.location, :assignment, suggestion: "Seed the initial value in the declaration, derive it from other states, count items with `#{assigned.first} += 1` behind a state condition in a keyed loop, or write it at runtime with `data-herb-set` or `state.set`.")
        end

        #: (StateDirectives::FoldIncrement, when_read: untyped, location: Herb::Location?) -> void
        def register_count(increment, when_read:, location:)
          name = increment.name
          declaration = @region_states[name]

          unless declaration
            return @visitor.slot_error("`#{name} += #{increment.by}` counts into `#{name}`, which is an item state. A count lives once per region, not once per item.", location, :count, suggestion: "Declare `#{name}` at the top of the template, outside the loop.")
          end

          if declaration.derived
            return @visitor.slot_error("`#{name} += #{increment.by}` counts into `#{name}`, which is derived from `#{declaration.default}`. A state is either derived or counted, never both.", location, :count, suggestion: "Drop the derivation from `#{name}`, or count into a second state.")
          end

          unless declaration.kind == :integer
            return @visitor.slot_error("`#{name} += #{increment.by}` counts into the #{declaration.kind.to_s.capitalize} state `#{name}`. A count is a number.", location, :count, suggestion: "Declare `#{name}` as an Integer, like `(#{name}: 0)`.")
          end

          if @state_counts.any? { |count| count[:name] == name }
            return @visitor.slot_error("`#{name}` is counted twice. One state holds one count.", location, :count, suggestion: "Declare a second state for the second count.")
          end

          if @visitor.recorded_expressions.any? { |expression| StateDirectives.mentions_any?(expression, { name => declaration }) }
            return @visitor.slot_error("`#{name}` is read before its count is complete. The server renders that read mid-count and the client cannot keep it current.", location, :count, suggestion: "Move the read below the loop that counts `#{name}`.")
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

              next @visitor.slot_error("`#{count[:name]}` is read inside the loop that counts it. The count is complete only after the loop.", node.location, :count, suggestion: "Move the read below the loop.")
            end
          end
        end

        #: (untyped, String) -> void
        def rewrite_predicate(node, name)
          return if rewrite_literal_predicate(node, name)

          token = predicate_token_for(node)

          return unless token

          token.value.replace(StateDirectives.rewrite_reads(token.value, name, @visitor.ruby_at(token.location)))
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
          rewritten = StateDirectives.rewrite_reads(literal.content.to_s, name, @visitor.ruby_at(literal.location))
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

        #: (untyped) -> Array[untyped]
        def interpolation_children(node)
          if node.is_a?(Herb::AST::HTMLElementNode)
            Array(node.body)
          elsif node.respond_to?(:value)
            node.value&.children || []
          else
            [] #: Array[untyped]
          end
        end

        #: (untyped, Integer, untyped) -> void
        def register_segment_reads(node, index, slot)
          segments = interpolation_children(node).select { |child| child.is_a?(Herb::AST::ERBIfNode) || child.is_a?(Herb::AST::ERBUnlessNode) || child.is_a?(Herb::AST::ERBCaseNode) }

          return if segments.empty?

          code = segments.map { |segment| segment_code(segment) }.join(" ")
          mentioned = @region_states.each_value.select { |declaration| mentioned_state(code, { declaration.name => declaration }) } # steep:ignore UnannotatedEmptyCollection

          return if mentioned.empty?

          entry = { "index" => index, "node_path" => slot.node_path }

          mentioned.each do |declaration|
            @server_reads[declaration.name] ||= [] # steep:ignore UnannotatedEmptyCollection
            @server_reads.fetch(declaration.name) << entry
          end
        end

        #: (untyped) -> String
        def segment_code(node)
          collected = [] #: Array[String]

          gather = lambda do |current|
            content = current.respond_to?(:content) ? current.content : nil #: untyped

            collected << content.value.to_s if content.respond_to?(:value)

            none = [] #: Array[untyped]
            children = current.respond_to?(:child_nodes) ? current.child_nodes : none

            children.compact.each { |child| gather.call(child) }
          end

          gather.call(node)

          collected.join(" ")
        end

        #: (untyped, Hash[String, StateDirectives::Declaration]) -> void
        def check_interpolated_state_read(node, states)
          children = interpolation_children(node)

          outputs = children.grep(Herb::AST::ERBContentNode)
          read = outputs.map { |output| output.content&.value.to_s.strip }.find { |expression| StateDirectives.mentions_any?(expression, states) }

          return unless read

          if node.is_a?(Herb::AST::HTMLElementNode)
            @visitor.slot_error("`#{read}` reads a state inside a `<#{node.tag_name&.value}>` that mixes other dynamic parts. A state write cannot supply the other values.", node.location, :read, suggestion: "Give the state its own element, or its own output outside this one.")
          else
            @visitor.slot_error("`#{read}` reads a state inside an interpolated attribute that mixes other dynamic parts. A state write cannot supply the other values.", node.location, :read, suggestion: "Give the state its own attribute, or its own output outside this one.")
          end
        end

        #: () -> void
        def check_state_value_reads
          @visitor.slot_nodes.each do |node|
            index = @visitor.index_for(node)

            next unless index

            slot = @visitor.slots[index]

            next unless slot.valued? || slot.presence?

            scope, = @visitor.scope_of(node)
            states = states_for(scope)

            next if states.empty?

            if slot.interpolated? && slot.expression.to_s.strip.empty?
              check_interpolated_state_read(node, states)
              register_segment_reads(node, index, slot)

              next
            end

            expression = slot.expression.to_s.strip
            expression = predicate_token_for(node)&.value.to_s.strip if expression.empty?

            next if expression.empty?
            next unless StateDirectives.mentions_any?(expression, states)

            next if refuse_mixed_boolean(node, slot, expression)
            next if convert_boolean_attribute(node, index, slot, expression, states)

            if states.key?(expression) || states.key?(expression.delete_suffix("?"))
              rewrite_predicate(node, expression.delete_suffix("?")) if expression.end_with?("?")

              next
            end

            register_state_value(node, index, slot, expression, states)
          end
        end

        #: (untyped, Integer, untyped, String, Hash[String, StateDirectives::Declaration]) -> void
        def register_state_value(node, index, slot, expression, states)
          read = slot.valued? ? StateDirectives.condition_read(expression, states, @visitor, condition_anchor(node, expression), resolved_ruby(node)) : nil

          return if read == :reported

          unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)
            return register_server_read(node, index, slot, expression, states)
          end

          StateDirectives.read_names(read).each { |name| rewrite_predicate(node, name) }

          @state_values[index] = read
        end

        #: () -> void
        def check_collection_reads
          @visitor.slot_nodes.each do |node|
            index = @visitor.index_for(node)

            next unless index

            slot = @visitor.slots[index]

            next unless [:collection, :keyed].include?(slot.type)

            expression = (slot.type == :keyed ? slot.key_expression : slot.expression).to_s.strip

            next if expression.empty?

            mentioned = @region_states.each_value.select { |declaration| mentioned_state(expression, { declaration.name => declaration }) } # steep:ignore UnannotatedEmptyCollection

            next if mentioned.empty?

            entry = { "index" => index, "node_path" => slot.node_path }

            mentioned.each do |declaration|
              @server_reads[declaration.name] ||= [] # steep:ignore UnannotatedEmptyCollection
              @server_reads.fetch(declaration.name) << entry
            end
          end
        end

        #: (untyped, Integer, untyped, String, Hash[String, StateDirectives::Declaration]) -> nil
        def register_server_read(node, index, slot, expression, states)
          mentioned = @region_states.each_value.select { |declaration| mentioned_state(expression, { declaration.name => declaration }) } # steep:ignore UnannotatedEmptyCollection

          if mentioned.empty?
            return @visitor.slot_error("`#{expression}` computes with the state `#{mentioned_state(expression, states)&.name}`, which lives on an item. The server cannot be asked for an item's answer yet.", condition_anchor(node, expression).location, :read, suggestion: "Show the value with `<%= #{mentioned_state(expression, states)&.name} %>`, or declare a second state for the computed answer and set it from app code.")
          end

          entry = { "index" => index, "node_path" => slot.node_path }

          mentioned.each do |declaration|
            @server_reads[declaration.name] ||= [] # steep:ignore UnannotatedEmptyCollection
            @server_reads.fetch(declaration.name) << entry
          end

          nil
        end

        #: (untyped, untyped, String) -> Symbol?
        def refuse_mixed_boolean(node, slot, expression)
          return nil unless slot.type == :attribute_interpolation
          return nil unless slot.attribute && Herb::HTML::Util.boolean_attribute?(slot.attribute)

          @visitor.slot_error(
            "`#{slot.attribute}` on this `<#{slot.tag}>` mixes `#{expression}` with other text. A boolean attribute follows presence and any value keeps it present, so it could never turn off.",
            node.location,
            :read,
            suggestion: "Make `<%= #{expression} %>` the whole value of `#{slot.attribute}`."
          )

          :reported
        end

        #: (untyped, Integer, untyped, String, Hash[String, StateDirectives::Declaration]) -> untyped
        def convert_boolean_attribute(node, index, slot, expression, states)
          return nil unless slot.type == :attribute || (slot.type == :boolean_attribute && !@state_presence.key?(index))
          return nil unless slot.attribute && Herb::HTML::Util.boolean_attribute?(slot.attribute)

          read = StateDirectives.condition_read(expression, states, @visitor, condition_anchor(node, expression), resolved_ruby(node))

          return :reported if read == :reported

          return nil unless read.is_a?(StateDirectives::Read) || read.is_a?(StateDirectives::Combo)

          if read.is_a?(StateDirectives::Read) && read.comparand.nil? && read.against.nil? && read.operator.nil? && !StateKinds::FALSY.include?(read.kind)
            @visitor.slot_error("`#{slot.attribute}=\"<%= #{expression} %>\"` reads #{StateDirectives.subject_phrase(read)} as a presence. Only `nil` and `false` are falsy in Ruby, so the attribute could never turn off.", condition_anchor(node, expression).location, :read, suggestion: "#{StateDirectives.predicate_advice(read.kind, read.name)}compare it to a literal#{StateDirectives.default_example(states.fetch(read.name), "#{read.name} == ")}, or declare it as a boolean.")

            return :reported
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
end
