# frozen_string_literal: true
# typed: true

require "prism"

module Herb
  class Engine
    # Parses `<%# herb:state (name: default, …) %>` directives and classifies how the body
    # reads the states they declare.
    class StateDirectives
      PATTERN = /\A-?\s*herb:state\s*(?<signature>\(.*\))\s*-?\z/m #: Regexp
      BARE = /\A[a-z_][a-zA-Z0-9_]*\z/ #: Regexp

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

      class << self
        #: (untyped) -> String?
        def signature_of(node)
          return nil unless node.is_a?(Herb::AST::ERBContentNode)
          return nil unless node.tag_opening&.value == "<%#"

          PATTERN.match(node.content&.value.to_s.strip)&.[](:signature)
        end

        #: (String, Hash[String, Symbol], ?enclosing: Hash[String, Declaration]) -> Array[Declaration]
        def parse(signature, locals, enclosing: {})
          result = Prism.parse("def __herb_states#{signature}; end")

          raise Herb::Engine::CompilationError, "`herb:state #{signature}` does not parse as a keyword signature" if result.failure?

          definition = result.value.statements.body.first
          parameters = definition.is_a?(Prism::DefNode) ? definition.parameters : nil

          unless parameters && parameters.requireds.empty? && parameters.optionals.empty? && parameters.rest.nil? &&
                 parameters.posts.empty? && parameters.keyword_rest.nil? && parameters.block.nil? &&
                 !parameters.keywords.empty?
            raise Herb::Engine::CompilationError,
                  "`herb:state #{signature}` must declare keyword parameters with defaults, like `(pending: false)`"
          end

          names = parameters.keywords.map { |keyword| keyword.name.to_s }
          declared = {} #: Hash[String, Declaration]

          parameters.keywords.map { |keyword|
            declaration = declaration_for(keyword, locals, declared, names, enclosing)
            declared[declaration.name] = declaration

            declaration
          }
        end

        #: (String, Hash[String, Declaration]) -> (Read | Combo | Symbol)?
        def condition_read(expression, states)
          source = expression.strip
          parsed = expression_node(source)

          return mentions_any?(source, states) ? :computed : nil if parsed.nil?

          read = tree_read(parsed, states)
          return read if read

          mentions_any?(source, states) ? :computed : nil
        end

        #: (untyped, Hash[String, Declaration]) -> (Read | Combo | Symbol)?
        def tree_read(node, states)
          node = unwrap_parentheses(node)

          read = bare_read(node, states)
          return read if read

          equality = equality_read(node, states)
          return equality if equality

          combo_read(node, states)
        end

        #: (untyped) -> untyped
        def unwrap_parentheses(node)
          return node unless node.is_a?(Prism::ParenthesesNode)

          body = node.body

          return node unless body.is_a?(Prism::StatementsNode) && body.body.one?

          unwrap_parentheses(body.body.first)
        end

        #: (untyped, Hash[String, Declaration]) -> (Combo | Symbol)?
        def combo_read(node, states)
          op = case node
               when Prism::AndNode then "all"
               when Prism::OrNode then "any"
               else return nil
               end

          parts = flatten_combo(node, node.class).map { |part| tree_read(part, states) }

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

        #: (untyped) -> Array[String]
        def condition_names(entry)
          return entry.values.flat_map { |parts| parts.flat_map { |part| condition_names(part) } } if entry.is_a?(Hash) && !entry.key?("state")
          return [entry["state"]] if entry.is_a?(Hash)

          names = [entry[0]] #: Array[String]
          names += condition_names(entry[1]) if entry[1].is_a?(Hash)

          names.uniq
        end

        #: (Read | Combo) -> untyped
        def condition_entry(read)
          return { read.op => read.parts.map { |part| condition_entry(part) } } if read.is_a?(Combo)

          comparand = read.against ? { "state" => read.against } : read.comparand

          read.operator ? [read.name, comparand, read.operator] : [read.name, comparand]
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
            when Prism::LocalVariableWriteNode, Prism::LocalVariableOperatorWriteNode,
                 Prism::LocalVariableOrWriteNode, Prism::LocalVariableAndWriteNode,
                 Prism::LocalVariableTargetNode
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
            return :mismatched unless kind == subject.kind || kind == :nil

            element.slice
          }
        end

        #: (Declaration) -> bool
        def seeded?(declaration)
          return false if declaration.derived

          node = expression_node(declaration.default)

          node.nil? || !KINDS.key?(node.class.name)
        end

        #: (String, Hash[String, Declaration]) -> bool
        def mentions_any?(source, states)
          states.each_key.any? { |name| /(?<![\w?])#{Regexp.escape(name)}\??(?![\w?!])/.match?(source) }
        end

        private

        #: (untyped, Hash[String, Symbol], Hash[String, Declaration], Array[String], Hash[String, Declaration]) -> Declaration
        def declaration_for(keyword, locals, declared, names, enclosing)
          name = keyword.name.to_s

          unless keyword.is_a?(Prism::OptionalKeywordParameterNode)
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` has no default; a state always has a value, since the server renders it"
          end

          value = keyword.value
          kind = KINDS[value.class.name]

          return Declaration.new(name: name, kind: kind, default: value.slice, derived: nil, line: nil, column: nil) if kind

          case value
          when Prism::FloatNode
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` has a Float default; Ruby and JavaScript disagree on how to print one, so floats are not supported"
          when Prism::ArrayNode
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` has an Array default; a list on the page is a collection of items, and per-row state is an item-scoped boolean"
          when Prism::HashNode, Prism::KeywordHashNode
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` has a Hash default; declare each leaf as its own state, like `#{name}_title`"
          when Prism::CallNode
            derived_default(name, value, declared, names) || bare_default(name, value, locals, enclosing)
          else
            derived_default(name, value, declared, names) ||
              Declaration.new(name: name, kind: :seeded, default: value.slice, derived: nil, line: nil, column: nil)
          end
        end

        #: (String, untyped, Hash[String, Declaration], Array[String]) -> Declaration?
        def derived_default(name, value, declared, names)
          read = tree_read(value, declared) #: untyped

          if read == :computed
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` defaults to `#{value.slice}`, which mixes state reads with other Ruby; " \
                  "a derived state reads only other states, and a seed reads none, so split the two apart"
          end

          if read.nil?
            later = {} #: Hash[String, untyped]
            (names - declared.keys - [name]).each { |candidate| later[candidate] = true }

            if mentions_any?(value.slice, later)
              raise Herb::Engine::CompilationError,
                    "the state `#{name}` reads a state that is declared after it; a derived state reads only " \
                    "states declared before it, so reorder the signature"
            end

            if mentions_any?(value.slice, declared)
              raise Herb::Engine::CompilationError,
                    "the state `#{name}` defaults to `#{value.slice}`, which mixes state reads with other Ruby; " \
                    "a derived state reads only other states, and a seed reads none, so split the two apart"
            end

            return nil
          end

          Declaration.new(name: name, kind: derived_kind(read), default: value.slice, derived: condition_entry(read), line: nil, column: nil)
        end

        #: (Read | Combo) -> Symbol
        def derived_kind(read)
          return read.kind || :seeded if read.is_a?(Read) && read.comparand.nil? && read.against.nil?

          :boolean
        end

        #: (String, untyped, Hash[String, Symbol], Hash[String, Declaration]) -> Declaration
        def bare_default(name, value, locals, enclosing)
          identifier = value.name.to_s

          unless value.receiver.nil? && value.arguments.nil? && value.block.nil? && BARE.match?(identifier)
            return Declaration.new(name: name, kind: :seeded, default: value.slice, derived: nil, line: nil, column: nil)
          end

          if enclosing.key?(identifier)
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` reads `#{identifier}` from an enclosing scope; a derived state reads " \
                  "states declared in its own signature, so declare it beside its sources"
          end

          kind = locals[identifier]

          unless kind
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` defaults to `#{identifier}`, which is not a declared strict local; " \
                  "a bare name that was never passed raises at render, so it has to be declared"
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

        #: (untyped, Hash[String, Declaration]) -> Read?
        def bare_read(node, states)
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
            raise Herb::Engine::CompilationError,
                  "`#{spelled}` reads the #{declaration.kind.to_s.capitalize} state `#{name}` as a predicate; " \
                  "only a boolean state can be read with a `?`"
          end

          Read.new(name: name, comparand: nil, kind: declaration.kind, operator: nil, against: nil)
        end

        #: (untyped, Hash[String, Declaration]) -> Read?
        def equality_read(node, states)
          return nil unless node.is_a?(Prism::CallNode)
          return nil unless node.name == :== || node.name == :!= || ORDERED_OPERATORS.include?(node.name)

          left = node.receiver
          right = node.arguments&.arguments&.first

          return nil unless left && right && node.arguments&.arguments&.one?

          left_read = bare_read(left, states)
          right_read = bare_read(right, states)
          read = left_read || right_read

          return nil unless read

          if left_read && right_read
            return state_pair_read(node, left_read, right_read)
          end

          literal = left_read ? right : left
          kind = KINDS[literal.class.name]

          unless kind
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` compares the state `#{read.name}` against something that is not a literal; " \
                  "the client resolves a comparison by lookup, so the comparand has to be one"
          end

          operator = node.name == :== ? nil : node.name.to_s
          operator = MIRRORED_OPERATORS.fetch(operator) if operator && operator != "!=" && bare_read(right, states)
          ordered = operator && operator != "!="

          if ordered && read.kind != :integer && read.kind != :seeded
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` orders the #{read.kind.to_s.capitalize} state `#{read.name}`; ordering compares " \
                  "numbers, so only an Integer state takes `#{node.name}`"
          end

          if ordered && kind != :integer
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` orders the state `#{read.name}` against a #{kind.to_s.capitalize} literal; " \
                  "ordering compares numbers, so the comparand has to be an Integer"
          end

          unless ordered || kind == read.kind || kind == :nil || read.kind == :seeded
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` compares the #{read.kind.to_s.capitalize} state `#{read.name}` against a #{kind.to_s.capitalize} literal"
          end

          Read.new(name: read.name, comparand: literal.slice, kind: read.kind, operator: operator, against: nil)
        end

        #: (untyped, Read, Read) -> Read
        def state_pair_read(node, left, right)
          operator = node.name == :== ? nil : node.name.to_s
          ordered = operator && operator != "!="

          if ordered && (left.kind != :integer || right.kind != :integer) && left.kind != :seeded && right.kind != :seeded
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` orders the states `#{left.name}` and `#{right.name}`; ordering compares numbers, " \
                  "so both have to be Integer states"
          end

          if !ordered && left.kind != right.kind && left.kind != :seeded && right.kind != :seeded
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` compares the #{left.kind.to_s.capitalize} state `#{left.name}` with the " \
                  "#{right.kind.to_s.capitalize} state `#{right.name}`, so it can never match"
          end

          Read.new(name: left.name, comparand: nil, kind: left.kind, operator: operator, against: right.name)
        end
      end
    end
  end
end
