# frozen_string_literal: true
# typed: true

require "prism"

module Herb
  class Engine
    module Slots
      # Parses `<%# herb:state (name: default, …) %>` directives and classifies how the body
      # reads the states they declare.
      #
      class StateDirectives
        PATTERN = /\A-?\s*herb:state\s*(?<signature>\(.*\))\s*-?\z/m #: Regexp
        BARE = /\A[a-z_][a-zA-Z0-9_]*\z/ #: Regexp
        PREFIX = "def __herb_states" #: String

        KINDS = {
          "Prism::TrueNode" => :boolean,
          "Prism::FalseNode" => :boolean,
          "Prism::IntegerNode" => :integer,
          "Prism::StringNode" => :string,
          "Prism::SymbolNode" => :symbol,
          "Prism::NilNode" => :nil,
        }.freeze #: Hash[String, Symbol]

        Declaration = Data.define(
          :name,    #: String
          :kind,    #: Symbol
          :default, #: String
          :derived, #: untyped
          :line,    #: Integer?
          :column   #: Integer?
        )

        Read = Data.define(
          :name,      #: String
          :comparand, #: String?
          :kind,      #: Symbol?
          :operator,  #: String?
          :against    #: String?
        )

        Combo = Data.define(
          :op,    #: String
          :parts  #: Array[untyped]
        )

        FoldIncrement = Data.define(
          :name, #: String
          :by    #: Integer
        )

        ORDERED_OPERATORS = [:>, :>=, :<, :<=].freeze #: Array[Symbol]
        MIRRORED_OPERATORS = { ">" => "<", ">=" => "<=", "<" => ">", "<=" => ">=" }.freeze #: Hash[String, String]

        Parsing = Data.define(
          :locals,    #: Hash[String, Symbol]
          :declared,  #: Hash[String, Declaration]
          :names,     #: Array[String]
          :enclosing, #: Hash[String, Declaration]
          :visitor,   #: untyped
          :location,  #: Herb::Location?
          :signature, #: String
          :anchor     #: Herb::Position?
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
          #: (untyped) -> String?
          def signature_of(node)
            return nil unless node.is_a?(Herb::AST::ERBContentNode)
            return nil unless node.tag_opening&.value == "<%#"

            PATTERN.match(node.content&.value.to_s.strip)&.[](:signature)
          end

          #: (String, Hash[String, Symbol], visitor: untyped, node: untyped, ?enclosing: Hash[String, Declaration]) -> Array[Declaration]
          def parse(signature, locals, visitor:, node:, enclosing: {})
            result = Prism.parse("#{PREFIX}#{signature}; end")
            location = node&.location
            anchor = node ? anchor_of(node, signature) : nil
            whole = anchor ? span(anchor, signature, 0, signature.length) : location

            if result.failure?
              visitor.slot_error("`herb:state #{signature}` does not parse as a keyword signature. Declare each state as a keyword parameter with a default, like `(pending: false)`.", whole, :declaration)

              return []
            end

            definition = result.value.statements.body.first
            parameters = definition.is_a?(Prism::DefNode) ? definition.parameters : nil

            unless parameters && parameters.requireds.empty? && parameters.optionals.empty? && parameters.rest.nil? && parameters.posts.empty? && parameters.keyword_rest.nil? && parameters.block.nil? && !parameters.keywords.empty?
              visitor.slot_error("`herb:state #{signature}` declares no keyword parameters. Declare each state with a default, like `(pending: false)`.", whole, :declaration)

              return []
            end

            declared = {} #: Hash[String, Declaration]

            parsing = Parsing.new(
              locals: locals,
              declared: declared,
              names: parameters.keywords.map { |keyword| keyword.name.to_s },
              enclosing: enclosing,
              visitor: visitor,
              location: location,
              signature: signature,
              anchor: anchor
            )

            parameters.keywords.map { |keyword|
              declaration = declaration_for(keyword, parsing)
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

            read.operator ? [read.name, comparand, read.operator] : [read.name, comparand]
          end

          #: (Read) -> untyped
          def comparand_entry(read)
            return { "state" => read.against } if read.against
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
              return read.name if read.comparand.nil? && read.against.nil?

              "#{read.name} #{read.operator || "=="} #{read.against || read.comparand}"
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

          #: ((Symbol | String)?) -> String
          def kind_article(kind)
            spelled = kind.to_s.capitalize

            return "a value" if spelled.empty?

            spelled.start_with?("A", "E", "I", "O", "U") ? "an #{spelled}" : "a #{spelled}"
          end

          #: (String, Hash[String, Declaration]) -> bool
          def mentions_any?(source, states)
            states.each_key.any? { |name| /(?<![\w?])#{Regexp.escape(name)}\??(?![\w?!])/.match?(source) }
          end

          private

          #: (untyped, String) -> Herb::Position?
          def anchor_of(node, signature)
            content = node.content
            start = content&.location&.start

            return nil unless start

            offset = content.value.to_s.index(signature)

            offset ? position_at(start, content.value.to_s, offset) : nil
          end

          #: (untyped, Parsing) -> Declaration
          def declaration_for(keyword, parsing)
            declaration = classify(keyword, parsing)
            spot = parsing.anchor ? spelled(keyword, parsing)&.start : nil

            spot ? declaration.with(line: spot.line, column: spot.column) : declaration
          end

          #: (untyped, Parsing) -> Declaration
          def classify(keyword, parsing)
            name = keyword.name.to_s
            visitor = parsing.visitor

            unless keyword.is_a?(Prism::OptionalKeywordParameterNode)
              return refused(name, "The state `#{name}` has no default. Give it one, since the server renders a value for every state, like `(#{name}: false)`.", visitor, spelled(keyword, parsing))
            end

            value = keyword.value
            kind = KINDS[value.class.name]

            return Declaration.new(name: name, kind: kind, default: value.slice, derived: nil, line: nil, column: nil) if kind

            location = located(value.location, parsing)

            case value
            when Prism::FloatNode
              refused(name, "The state `#{name}` has a Float default. Ruby and JavaScript disagree on how to print a float, so declare it as an Integer or a String instead.", visitor, location, value.slice)
            when Prism::ArrayNode
              refused(name, "The state `#{name}` has an Array default. A list on the page is a collection of items, so declare an item-scoped boolean inside the loop instead.", visitor, location, value.slice)
            when Prism::HashNode, Prism::KeywordHashNode
              refused(name, "The state `#{name}` has a Hash default. Declare each leaf as its own state, like `(#{name}_title: \"\")`.", visitor, location, value.slice)
            when Prism::CallNode
              derived_default(name, value, parsing) || bare_default(name, value, parsing)
            else
              derived_default(name, value, parsing) ||
                Declaration.new(name: name, kind: :seeded, default: value.slice, derived: nil, line: nil, column: nil)
            end
          end

          #: (untyped, Parsing) -> Herb::Location?
          def spelled(keyword, parsing)
            anchor = parsing.anchor

            return parsing.location unless anchor

            start = keyword.name_loc.start_character_offset - PREFIX.length

            span(anchor, parsing.signature, start, start + keyword.name.to_s.length)
          end

          #: (untyped, Parsing) -> Herb::Location?
          def located(location, parsing)
            anchor = parsing.anchor

            return parsing.location unless anchor && location

            span(anchor, parsing.signature, location.start_character_offset - PREFIX.length, location.end_character_offset - PREFIX.length)
          end

          #: (Herb::Position, String, Integer, Integer) -> Herb::Location
          def span(anchor, source, start_offset, end_offset)
            Herb::Location.new(position_at(anchor, source, start_offset), position_at(anchor, source, end_offset))
          end

          #: (Herb::Position, String, Integer) -> Herb::Position
          def position_at(anchor, source, offset)
            consumed = source.slice(0, offset).to_s
            last = consumed.rindex("\n")

            return Herb::Position.new(anchor.line, anchor.column + consumed.length) unless last

            Herb::Position.new(anchor.line + consumed.count("\n"), consumed.length - last - 1)
          end

          #: (String, String, untyped, Herb::Location?, ?String) -> Declaration
          def refused(name, message, visitor, location, default = "nil")
            visitor.slot_error(message, location, :declaration)

            Declaration.new(name: name, kind: :seeded, default: default, derived: nil, line: nil, column: nil)
          end

          #: (String, untyped, Parsing) -> Declaration?
          def derived_default(name, value, parsing)
            declared = parsing.declared
            visitor = parsing.visitor
            location = located(value.location, parsing)

            said = visitor.diagnostic_count
            read = tree_read(value, declared, visitor, location) #: untyped

            return Declaration.new(name: name, kind: :seeded, default: value.slice, derived: nil, line: nil, column: nil) if visitor.diagnostic_count > said

            if read == :computed
              return refused(name, "The state `#{name}` defaults to `#{value.slice}`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none, so split the two apart.", visitor, location, value.slice)
            end

            if read.nil?
              later = {} #: Hash[String, untyped]
              (parsing.names - declared.keys - [name]).each { |candidate| later[candidate] = true }

              if mentions_any?(value.slice, later)
                return refused(name, "The state `#{name}` reads a state declared after it. A derived state reads only states declared before it, so move `#{name}` after the states it reads.", visitor, location)
              end

              if mentions_any?(value.slice, declared)
                return refused(name, "The state `#{name}` defaults to `#{value.slice}`, which mixes state reads with other Ruby. A derived state reads only other states and a seed reads none, so split the two apart.", visitor, location, value.slice)
              end

              return nil
            end

            Declaration.new(name: name, kind: derived_kind(read), default: value.slice, derived: read, line: nil, column: nil)
          end

          #: (Read | Combo) -> Symbol
          def derived_kind(read)
            return read.kind || :seeded if read.is_a?(Read) && read.comparand.nil? && read.against.nil?

            :boolean
          end

          #: (String, untyped, Parsing) -> Declaration
          def bare_default(name, value, parsing)
            identifier = value.name.to_s
            visitor = parsing.visitor
            location = located(value.location, parsing)

            unless value.receiver.nil? && value.arguments.nil? && value.block.nil? && BARE.match?(identifier)
              return Declaration.new(name: name, kind: :seeded, default: value.slice, derived: nil, line: nil, column: nil)
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
          def bare_read(node, states, visitor, location)
            if node.is_a?(Prism::LocalVariableReadNode)
              declaration = states[node.name.to_s]

              return nil unless declaration

              return Read.new(name: node.name.to_s, comparand: nil, kind: declaration.kind, operator: nil, against: nil)
            end

            return nil unless node.is_a?(Prism::CallNode) && node.receiver.nil? && node.arguments.nil? && node.block.nil?

            spelled = node.name.to_s
            predicate = spelled.end_with?("?")
            name = predicate ? spelled.delete_suffix("?") : spelled
            declaration = states[name]

            return nil unless declaration

            if predicate && declaration.kind != :boolean && declaration.kind != :seeded
              return visitor.slot_error("`#{spelled}` reads the #{declaration.kind.to_s.capitalize} state `#{name}` as a predicate. Only a boolean state can be read with a `?`, so drop the `?` or declare `#{name}` as a boolean.", location, :read)
            end

            Read.new(name: name, comparand: nil, kind: declaration.kind, operator: nil, against: nil)
          end

          #: (untyped, Hash[String, Declaration], untyped, Herb::Location?) -> Read?
          def equality_read(node, states, visitor, location)
            return nil unless node.is_a?(Prism::CallNode)
            return nil unless node.name == :== || node.name == :!= || ORDERED_OPERATORS.include?(node.name)

            left = node.receiver
            right = node.arguments&.arguments&.first

            return nil unless left && right && node.arguments&.arguments&.one?

            left_read = bare_read(left, states, visitor, location)
            right_read = bare_read(right, states, visitor, location)
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
            operator = MIRRORED_OPERATORS.fetch(operator) if operator && operator != "!=" && bare_read(right, states, visitor, location)
            ordered = operator && operator != "!="

            if ordered && read.kind != :integer && read.kind != :seeded
              return visitor.slot_error("`#{node.slice}` orders the #{read.kind.to_s.capitalize} state `#{read.name}`. Ordering compares numbers, so declare `#{read.name}` as an Integer or compare it with `==` instead.", location, :compare)
            end

            if ordered && kind != :integer
              return visitor.slot_error("`#{node.slice}` orders the state `#{read.name}` against #{kind_article(kind)} literal. Ordering compares numbers, so compare it against an Integer literal instead.", location, :compare)
            end

            unless ordered || kind == read.kind || kind == :nil || read.kind == :seeded
              return visitor.slot_error("`#{node.slice}` compares the #{read.kind.to_s.capitalize} state `#{read.name}` against #{kind_article(kind)} literal, so it can never match. Compare it against #{kind_article(read.kind)} literal instead.", location, :compare)
            end

            Read.new(name: read.name, comparand: literal.slice, kind: read.kind, operator: operator, against: nil)
          end

          #: (untyped, Read, Read, untyped, Herb::Location?) -> Read?
          def state_pair_read(node, left, right, visitor, location)
            operator = node.name == :== ? nil : node.name.to_s
            ordered = operator && operator != "!="

            if ordered && (left.kind != :integer || right.kind != :integer) && left.kind != :seeded && right.kind != :seeded
              return visitor.slot_error("`#{node.slice}` orders the states `#{left.name}` and `#{right.name}`. Ordering compares numbers, so declare both as Integers.", location, :compare)
            end

            if !ordered && left.kind != right.kind && left.kind != :seeded && right.kind != :seeded
              return visitor.slot_error("`#{node.slice}` compares the #{left.kind.to_s.capitalize} state `#{left.name}` with the #{right.kind.to_s.capitalize} state `#{right.name}`, so it can never match. Compare states of the same kind.", location, :compare)
            end

            Read.new(name: left.name, comparand: nil, kind: left.kind, operator: operator, against: right.name)
          end
        end
      end
    end
  end
end
