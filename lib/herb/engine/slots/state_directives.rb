# frozen_string_literal: true
# typed: true

require "prism"

require_relative "state_kinds"
require_relative "state_operators"
require_relative "state_predicates"
require_relative "state_transforms"

module Herb
  class Engine
    module Slots
      # Parses `<%# herb:state (name: default, …) %>` directives and classifies how the body
      # reads the states they declare.
      #
      class StateDirectives
        BARE = /\A[a-z_][a-zA-Z0-9_]*\z/ #: Regexp

        KINDS = StateKinds::PRISM #: Hash[String, Symbol]

        NODE_KINDS = StateKinds::NODE #: Hash[String, Symbol]

        IDENTIFIER_TOKENS = [:IDENTIFIER, :METHOD_NAME].freeze #: Array[Symbol]

        Declaration = Data.define(
          :name,    #: String
          :kind,    #: Symbol
          :default, #: String
          :derived, #: untyped
          :line,    #: Integer?
          :column   #: Integer?
        )

        Read = Data.define(
          :name,             #: String
          :comparand,        #: String?
          :kind,             #: Symbol?
          :operator,         #: String?
          :against,          #: String?
          :transform,        #: String?
          :against_transform #: String?
        )

        Combo = Data.define(
          :op,    #: String
          :parts  #: Array[untyped]
        )

        FoldIncrement = Data.define(
          :name, #: String
          :by    #: Integer
        )

        ORDERED_OPERATORS = StateOperators::ORDERED #: Array[Symbol]
        MIRRORED_OPERATORS = StateOperators::MIRRORED #: Hash[String, String]
        NEGATED_OPERATORS = StateOperators::NEGATED #: Hash[String, String]

        FALSY_OPERATOR = "falsy" #: String

        PREDICATES = StatePredicates::TABLE #: Hash[String, Hash[Symbol, untyped]]

        UNARY_OPERATORS = StatePredicates::UNARY #: Hash[String, String]

        NEGATED_UNARY = StatePredicates::NEGATED #: Hash[String, String]

        TRANSFORMS = StateTransforms::TABLE #: Hash[String, Hash[Symbol, untyped]]

        TRANSFORM_SPELLINGS = StateTransforms::SPELLINGS #: Hash[String, String]

        Parsing = Data.define(
          :locals,    #: Hash[String, Symbol]
          :declared,  #: Hash[String, Declaration]
          :names,     #: Array[String]
          :enclosing, #: Hash[String, Declaration]
          :visitor,   #: untyped
          :location   #: Herb::Location?
        )

        module Silent
          #: (String, Herb::Location?, Symbol) -> nil
          def self.slot_error(_message, _location, _family)
            nil
          end

          #: (?Symbol?) -> Integer
          def self.diagnostic_count(_severity = nil)
            0
          end
        end

        class << self
          #: (untyped, Hash[String, Symbol], visitor: untyped, ?enclosing: Hash[String, Declaration]) -> Array[Declaration]
          def parse(node, locals, visitor:, enclosing: {})
            states = node.states

            return [] if states.empty?

            declared = {} #: Hash[String, Declaration]

            parsing = Parsing.new(
              locals: locals,
              declared: declared,
              names: states.map { |state| state.name&.value.to_s },
              enclosing: enclosing,
              visitor: visitor,
              location: node.location
            )

            states.map { |state|
              declaration = declaration_for(state, parsing)
              declared[declaration.name] = declaration

              declaration
            }
          end

          #: (String, Hash[String, Declaration], untyped, Herb::Location?) -> (Read | Combo | Symbol)?
          def condition_read(expression, states, visitor, location)
            source = expression.strip
            parsed = expression_node(source)

            return mentions_any?(source, states) ? :computed : nil if parsed.nil?

            said = visitor.diagnostic_count
            read = tree_read(parsed, states, visitor, location)

            return :reported if visitor.diagnostic_count > said
            return read if read

            mentions_any?(source, states) ? :computed : nil
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> (Read | Combo | Symbol)?
          def tree_read(node, states, visitor, location)
            node = unwrap_parentheses(node)

            read = bare_read(node, states, visitor, location)
            return read if read

            predicate = predicate_read(node, states, visitor, location)
            return predicate if predicate

            transform = transform_read(node, states, visitor, location)
            return transform if transform

            negated = negated_read(node, states, visitor, location)
            return negated if negated

            equality = equality_read(node, states, visitor, location)
            return equality if equality

            combo_read(node, states, visitor, location)
          end

          #: (untyped) -> untyped
          def unwrap_parentheses(node)
            return node unless node.is_a?(Prism::ParenthesesNode)

            body = node.body

            return node unless body.is_a?(Prism::StatementsNode) && body.body.one?

            unwrap_parentheses(body.body.first)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> (Combo | Symbol)?
          def combo_read(node, states, visitor, location)
            op = case node
                 when Prism::AndNode then "all"
                 when Prism::OrNode then "any"
                 else return nil
                 end

            parts = flatten_combo(node, node.class).map { |part| tree_read(part, states, visitor, location) }

            return nil if parts.none? { |part| part.is_a?(Read) || part.is_a?(Combo) }
            return :computed if parts.any? { |part| part.nil? || part == :computed }

            Combo.new(op: op, parts: parts)
          end

          #: (untyped, untyped) -> Array[untyped]
          def flatten_combo(node, klass)
            return [node] unless node.is_a?(klass)

            flatten_combo(node.left, klass) + flatten_combo(node.right, klass)
          end

          #: (Read | Combo) -> Array[String]
          def read_names(read)
            return [read.name, read.against].compact if read.is_a?(Read)

            read.parts.flat_map { |part| read_names(part) }
          end

          #: (Read | Combo) -> untyped
          def condition_entry(read)
            return { read.op => read.parts.map { |part| condition_entry(part) } } if read.is_a?(Combo)

            comparand = comparand_entry(read)

            if read.transform
              return [read.name, comparand, read.operator || (comparand ? "==" : nil), read.transform]
            end

            read.operator ? [read.name, comparand, read.operator] : [read.name, comparand]
          end

          #: (Read) -> untyped
          def comparand_entry(read)
            if read.against
              entry = { "state" => read.against } #: Hash[String, untyped]
              entry["transform"] = read.against_transform if read.against_transform

              return entry
            end

            return nil unless read.comparand

            { "value" => literal_value(read.comparand) }
          end

          #: (String) -> untyped
          def literal_value(source)
            node = expression_node(source)

            case node
            when Prism::TrueNode then true
            when Prism::FalseNode then false
            when Prism::NilNode then nil
            when Prism::IntegerNode then node.value
            when Prism::StringNode, Prism::SymbolNode then node.unescaped
            end
          end

          #: (String) -> bool
          def literal?(source)
            node = expression_node(source)

            !node.nil? && KINDS.key?(node.class.name)
          end

          #: (Read | Combo) -> String
          def condition_source(read)
            if read.is_a?(Read)
              spelled = UNARY_OPERATORS[read.operator.to_s]
              subject = read.transform ? "#{read.name}.#{TRANSFORM_SPELLINGS.fetch(read.transform)}" : read.name

              return "#{subject}.#{spelled}" if spelled
              return "!#{subject}" if read.operator == FALSY_OPERATOR
              return subject if read.comparand.nil? && read.against.nil?

              against = read.against && read.against_transform ? "#{read.against}.#{TRANSFORM_SPELLINGS.fetch(read.against_transform)}" : read.against

              "#{subject} #{read.operator || "=="} #{against || read.comparand}"
            else
              joiner = read.op == "all" ? " && " : " || "

              "(#{read.parts.map { |part| condition_source(part) }.join(joiner)})"
            end
          end

          #: (String) -> FoldIncrement?
          def fold_increment(source)
            result = Prism.parse(source.to_s.strip)

            return nil if result.failure?

            body = result.value.statements.body

            return nil unless body.one?

            node = body.first

            case node
            when Prism::LocalVariableOperatorWriteNode
              return nil unless node.binary_operator == :+

              step = node.value

              return nil unless step.is_a?(Prism::IntegerNode)

              FoldIncrement.new(name: node.name.to_s, by: step.value)
            when Prism::LocalVariableWriteNode
              value = node.value

              return nil unless value.is_a?(Prism::CallNode) && value.name == :+

              receiver = value.receiver

              return nil unless receiver.is_a?(Prism::LocalVariableReadNode) && receiver.name == node.name

              arguments = value.arguments&.arguments

              return nil unless arguments&.one?

              step = arguments.first

              return nil unless step.is_a?(Prism::IntegerNode)

              FoldIncrement.new(name: node.name.to_s, by: step.value)
            end
          end

          #: (String, Hash[String, Declaration]) -> Array[String]
          def assigned_state_names(source, states)
            return [] unless mentions_any?(source, states)

            result = Prism.parse(source)

            return [] if result.failure?

            names = [] #: Array[String]
            queue = [] #: Array[untyped]

            queue << result.value

            while (node = queue.shift)
              case node
              when Prism::LocalVariableWriteNode, Prism::LocalVariableOperatorWriteNode, Prism::LocalVariableOrWriteNode, Prism::LocalVariableAndWriteNode, Prism::LocalVariableTargetNode
                names << node.name.to_s if states.key?(node.name.to_s)
              end

              queue.concat(node.child_nodes.compact) if node.respond_to?(:child_nodes)
            end

            names.uniq
          end

          #: (String, Declaration) -> (Array[String] | Symbol)
          def when_comparands(list, subject)
            result = Prism.parse("[#{list}]")

            return :computed if result.failure?

            array = result.value.statements.body.first

            return :computed unless array.is_a?(Prism::ArrayNode)

            array.elements.map { |element|
              kind = KINDS[element.class.name]

              return :computed unless kind
              return :mismatched unless kind == subject.kind || kind == :nil || subject.kind == :seeded

              element.slice
            }
          end

          #: (Declaration) -> bool
          def seeded?(declaration)
            return false if declaration.derived

            node = expression_node(declaration.default)

            node.nil? || !KINDS.key?(node.class.name)
          end

          #: (Read) -> String
          def subject_phrase(read)
            return "the #{TRANSFORM_SPELLINGS.fetch(read.transform)} of the state `#{read.name}`" if read.transform

            "the #{read.kind.to_s.capitalize} state `#{read.name}`"
          end

          #: ((Symbol | String)?) -> String
          def kind_article(kind)
            known = StateKinds::ARTICLES[kind.to_s]

            return known if known

            spelled = kind.to_s.capitalize

            return "a value" if spelled.empty?

            spelled.start_with?("A", "E", "I", "O", "U") ? "an #{spelled}" : "a #{spelled}"
          end

          #: (String, String) -> String
          def rewrite_reads(source, name)
            rewritten = source

            PREDICATES.each do |spelled, predicate|
              rewrite = predicate[:rewrite]

              next unless rewrite

              rewritten = rewritten.gsub(/(?<![\w?!])#{Regexp.escape(name)}\.#{Regexp.escape(spelled)}(?![\w?!])/) { "(#{name} #{rewrite})" }
            end

            rewritten.gsub(/(?<![\w?!])#{Regexp.escape(name)}\?(?![\w?!])/) { name }
          end

          #: (String, Hash[String, Declaration]) -> bool
          def mentions_any?(source, states)
            return false if states.empty?

            identifiers(source).any? { |identifier| states.key?(identifier) }
          end

          private

          #: (String) -> Array[String]
          def identifiers(source)
            names = [] #: Array[String]
            previous = nil #: Symbol?

            Prism.lex(source).value.map(&:first).each do |token|
              type = token.type

              names << token.value.delete_suffix("?") if IDENTIFIER_TOKENS.include?(type) && previous != :SYMBOL_BEGIN

              previous = type
            end

            names
          end

          #: (untyped, Parsing) -> Declaration
          def declaration_for(state, parsing)
            spot = state.name&.location&.start
            declaration = classify(state, parsing)

            spot ? declaration.with(line: spot.line, column: spot.column) : declaration
          end

          #: (untyped, Parsing) -> Declaration
          def classify(state, parsing)
            name = state.name&.value.to_s
            visitor = parsing.visitor
            default = state.default_value
            location = default&.location || state.name&.location || parsing.location

            if state.kind == "missing" || default.nil?
              return refused(name, "The state `#{name}` has no default. Give it one, since the server renders a value for every state, like `(#{name}: false)`.", visitor, state.name&.location || parsing.location)
            end

            source = default.content.to_s
            kind = NODE_KINDS[state.kind]

            return Declaration.new(name: name, kind: kind, default: source, derived: nil, line: nil, column: nil) if kind

            case state.kind
            when "float"
              refused(name, "The state `#{name}` has a Float default. Ruby and JavaScript disagree on how to print a float, so declare it as an Integer or a String instead.", visitor, location, source)
            when "array"
              refused(name, "The state `#{name}` has an Array default. A list on the page is a collection of items, so declare an item-scoped boolean inside the loop instead.", visitor, location, source)
            when "hash"
              refused(name, "The state `#{name}` has a Hash default. Declare each leaf as its own state, like `(#{name}_title: \"\")`.", visitor, location, source)
            when "bare"
              derived_default(name, source, location, parsing) || bare_default(name, source, location, parsing)
            else
              derived_default(name, source, location, parsing) ||
                Declaration.new(name: name, kind: :seeded, default: source, derived: nil, line: nil, column: nil)
            end
          end

          #: (String, String, untyped, Herb::Location?, ?String) -> Declaration
          def refused(name, message, visitor, location, default = "nil")
            visitor.slot_error(message, location, :declaration)

            Declaration.new(name: name, kind: :seeded, default: default, derived: nil, line: nil, column: nil)
          end

          #: (String, String, Herb::Location?, Parsing) -> Declaration?
          def derived_default(name, source, location, parsing)
            declared = parsing.declared
            visitor = parsing.visitor
            value = expression_node(source)

            return nil if value.nil?

            said = visitor.diagnostic_count
            read = tree_read(value, declared, visitor, location) #: untyped

            return Declaration.new(name: name, kind: :seeded, default: source, derived: nil, line: nil, column: nil) if visitor.diagnostic_count > said

            if read == :computed
              return refused(name, "The state `#{name}` defaults to `#{source}`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none, so split the two apart.", visitor, location, source)
            end

            if read.nil?
              later = {} #: Hash[String, untyped]
              (parsing.names - declared.keys - [name]).each { |candidate| later[candidate] = true }

              if mentions_any?(source, later)
                return refused(name, "The state `#{name}` reads a state declared after it. A derived state reads only states declared before it, so move `#{name}` after the states it reads.", visitor, location)
              end

              if mentions_any?(source, declared)
                return refused(name, "The state `#{name}` defaults to `#{source}`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none, so split the two apart.", visitor, location, source)
              end

              return nil
            end

            Declaration.new(name: name, kind: derived_kind(read), default: source, derived: read, line: nil, column: nil)
          end

          #: (Read | Combo) -> Symbol
          def derived_kind(read)
            return read.kind || :seeded if read.is_a?(Read) && read.comparand.nil? && read.against.nil? && read.operator.nil?

            :boolean
          end

          #: (String, String, Herb::Location?, Parsing) -> Declaration
          def bare_default(name, identifier, location, parsing)
            visitor = parsing.visitor

            unless BARE.match?(identifier)
              return Declaration.new(name: name, kind: :seeded, default: identifier, derived: nil, line: nil, column: nil)
            end

            if parsing.enclosing.key?(identifier)
              return refused(name, "The state `#{name}` reads `#{identifier}` from an enclosing scope. A derived state reads only states from its own signature, so declare `#{name}` beside the states it reads.", visitor, location)
            end

            kind = parsing.locals[identifier]

            unless kind
              return refused(name, "The state `#{name}` defaults to `#{identifier}`, which is not a declared strict local. A name that was never passed raises at render, so add `#{identifier}` to the `locals:` signature.", visitor, location)
            end

            Declaration.new(name: name, kind: kind, default: identifier, derived: nil, line: nil, column: nil)
          end

          #: (String) -> untyped
          def expression_node(source)
            result = Prism.parse(source)

            return nil if result.failure?

            body = result.value.statements.body

            body.one? ? body.first : nil
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> Read?
          def bare_read(node, states, _visitor, _location)
            if node.is_a?(Prism::LocalVariableReadNode)
              declaration = states[node.name.to_s]

              return nil unless declaration

              return Read.new(name: node.name.to_s, comparand: nil, kind: declaration.kind, operator: nil, against: nil, transform: nil, against_transform: nil)
            end

            return nil unless node.is_a?(Prism::CallNode) && node.receiver.nil? && node.arguments.nil? && node.block.nil?

            spelled = node.name.to_s
            predicate = spelled.end_with?("?")
            name = predicate ? spelled.delete_suffix("?") : spelled
            declaration = states[name]

            return nil unless declaration

            Read.new(name: name, comparand: nil, kind: declaration.kind, operator: nil, against: nil, transform: nil, against_transform: nil)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> Read?
          def operand_read(node, states, visitor, location)
            bare_read(node, states, visitor, location) || transform_read(node, states, visitor, location)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> Read?
          def transform_read(node, states, visitor, location)
            return nil unless node.is_a?(Prism::CallNode)

            transform = TRANSFORMS[node.name.to_s]

            return nil unless transform
            return nil unless node.arguments.nil? && node.block.nil?

            receiver = node.receiver

            return nil unless receiver

            read = bare_read(receiver, states, visitor, location)

            return nil unless read.is_a?(Read)

            kinds = transform.fetch(:kinds)

            if kinds && read.kind != :seeded && !kinds.include?(read.kind)
              return visitor.slot_error("`#{node.slice}` reads the #{read.kind.to_s.capitalize} state `#{read.name}` with `#{node.name}`. Only #{transform.fetch(:only)} can be read with `#{node.name}`, so compare `#{read.name}` itself instead.", location, :read)
            end

            Read.new(name: read.name, comparand: nil, kind: transform.fetch(:returns), operator: nil, against: nil, transform: transform.fetch(:operation), against_transform: nil)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> Read?
          def predicate_read(node, states, visitor, location)
            return nil unless node.is_a?(Prism::CallNode)

            predicate = PREDICATES[node.name.to_s]

            return nil unless predicate
            return nil unless node.arguments.nil? && node.block.nil?

            receiver = node.receiver

            return nil unless receiver

            read = bare_read(receiver, states, visitor, location)

            return nil unless read.is_a?(Read)

            kinds = predicate[:kinds]

            if kinds && read.kind != :seeded && !kinds.include?(read.kind)
              return visitor.slot_error("`#{node.slice}` reads the #{read.kind.to_s.capitalize} state `#{read.name}` with `#{node.name}`. Only #{predicate.fetch(:only)} can be read with `#{node.name}`, so compare `#{read.name}` to a literal instead.", location, :read)
            end

            Read.new(name: read.name, comparand: predicate[:comparand], kind: read.kind, operator: predicate[:operator], against: nil, transform: nil, against_transform: nil)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> (Read | Combo)?
          def negated_read(node, states, visitor, location)
            return nil unless node.is_a?(Prism::CallNode) && node.name == :!
            return nil unless node.receiver && node.arguments.nil? && node.block.nil?

            inner = tree_read(unwrap_parentheses(node.receiver), states, visitor, location)

            return nil unless inner.is_a?(Read) || inner.is_a?(Combo)

            negate(inner)
          end

          #: (Read | Combo) -> (Read | Combo)
          def negate(read)
            return Combo.new(op: read.op == "all" ? "any" : "all", parts: read.parts.map { |part| negate(part) }) if read.is_a?(Combo)

            return read.with(operator: NEGATED_UNARY.fetch(read.operator), kind: :boolean) if NEGATED_UNARY.key?(read.operator.to_s)
            return read.with(operator: nil, kind: :boolean) if read.operator == FALSY_OPERATOR
            return read.with(operator: FALSY_OPERATOR, kind: :boolean) if read.operator.nil? && read.comparand.nil? && read.against.nil?

            read.with(operator: NEGATED_OPERATORS.fetch(read.operator || "=="), kind: :boolean)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> Read?
          def equality_read(node, states, visitor, location)
            return nil unless node.is_a?(Prism::CallNode)
            return nil unless node.name == :== || node.name == :!= || ORDERED_OPERATORS.include?(node.name)

            left = node.receiver
            right = node.arguments&.arguments&.first

            return nil unless left && right && node.arguments&.arguments&.one?

            left_read = operand_read(left, states, visitor, location)
            right_read = operand_read(right, states, visitor, location)
            read = left_read || right_read

            return nil unless read

            if left_read && right_read
              return state_pair_read(node, left_read, right_read, visitor, location)
            end

            literal = left_read ? right : left
            kind = KINDS[literal.class.name]

            unless kind
              return visitor.slot_error("`#{node.slice}` compares the state `#{read.name}` against something that is not a literal. The client resolves a comparison by lookup, so compare against a literal instead.", location, :compare)
            end

            operator = node.name == :== ? nil : node.name.to_s
            operator = MIRRORED_OPERATORS.fetch(operator) if operator && operator != "!=" && right_read
            ordered = operator && operator != "!="

            if ordered && read.kind != :integer && read.kind != :seeded
              return visitor.slot_error("`#{node.slice}` orders #{subject_phrase(read)}. Ordering compares numbers, so declare `#{read.name}` as an Integer or compare it with `==` instead.", location, :compare)
            end

            if ordered && kind != :integer
              return visitor.slot_error("`#{node.slice}` orders the state `#{read.name}` against #{kind_article(kind)} literal. Ordering compares numbers, so compare it against an Integer literal instead.", location, :compare)
            end

            unless ordered || kind == read.kind || kind == :nil || read.kind == :seeded
              return visitor.slot_error("`#{node.slice}` compares #{subject_phrase(read)} against #{kind_article(kind)} literal, so it can never match. Compare it against #{kind_article(read.kind)} literal instead.", location, :compare)
            end

            Read.new(name: read.name, comparand: literal.slice, kind: read.kind, operator: operator, against: nil, transform: read.transform, against_transform: nil)
          end

          #: (untyped, Read, Read, untyped, Herb::Location?) -> Read?
          def state_pair_read(node, left, right, visitor, location)
            operator = node.name == :== ? nil : node.name.to_s

            if right.transform && !left.transform
              left, right = right, left
              operator = MIRRORED_OPERATORS.fetch(operator) if operator && operator != "!="
            end

            ordered = operator && operator != "!="

            if ordered && (left.kind != :integer || right.kind != :integer) && left.kind != :seeded && right.kind != :seeded
              return visitor.slot_error("`#{node.slice}` orders #{subject_phrase(left)} against #{subject_phrase(right)}. Ordering compares numbers, so both sides have to be Integers.", location, :compare)
            end

            if !ordered && left.kind != right.kind && left.kind != :seeded && right.kind != :seeded
              return visitor.slot_error("`#{node.slice}` compares #{subject_phrase(left)} with #{subject_phrase(right)}, so it can never match. Compare values of the same kind.", location, :compare)
            end

            Read.new(name: left.name, comparand: nil, kind: left.kind, operator: operator, against: right.name, transform: left.transform, against_transform: right.transform)
          end
        end
      end
    end
  end
end
