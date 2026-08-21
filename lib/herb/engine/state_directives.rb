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

      ORDERED_OPERATORS = [:>, :>=, :<, :<=].freeze #: Array[Symbol]
      MIRRORED_OPERATORS = { ">" => "<", ">=" => "<=", "<" => ">", "<=" => ">=" }.freeze #: Hash[String, String]

      class << self
        #: (untyped) -> String?
        def signature_of(node)
          return nil unless node.is_a?(Herb::AST::ERBContentNode)
          return nil unless node.tag_opening&.value == "<%#"

          PATTERN.match(node.content&.value.to_s.strip)&.[](:signature)
        end

        #: (String, Hash[String, Symbol]) -> Array[Declaration]
        def parse(signature, locals)
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

          parameters.keywords.map { |keyword| declaration_for(keyword, locals) }
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

        #: (String, Hash[String, Declaration]) -> bool
        def mentions_any?(source, states)
          states.each_key.any? { |name| /(?<![\w?])#{Regexp.escape(name)}\??(?![\w?!])/.match?(source) }
        end

        private

        #: (untyped, Hash[String, Symbol]) -> Declaration
        def declaration_for(keyword, locals)
          name = keyword.name.to_s

          unless keyword.is_a?(Prism::OptionalKeywordParameterNode)
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` has no default; a state always has a value, since the server renders it"
          end

          value = keyword.value
          kind = KINDS[value.class.name]

          return Declaration.new(name: name, kind: kind, default: value.slice, line: nil, column: nil) if kind

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
            bare_default(name, value, locals)
          else
            Declaration.new(name: name, kind: :seeded, default: value.slice, line: nil, column: nil)
          end
        end

        #: (String, untyped, Hash[String, Symbol]) -> Declaration
        def bare_default(name, value, locals)
          identifier = value.name.to_s

          unless value.receiver.nil? && value.arguments.nil? && value.block.nil? && BARE.match?(identifier)
            return Declaration.new(name: name, kind: :seeded, default: value.slice, line: nil, column: nil)
          end

          kind = locals[identifier]

          unless kind
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` defaults to `#{identifier}`, which is not a declared strict local; " \
                  "a bare name that was never passed raises at render, so it has to be declared"
          end

          Declaration.new(name: name, kind: kind, default: identifier, line: nil, column: nil)
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
