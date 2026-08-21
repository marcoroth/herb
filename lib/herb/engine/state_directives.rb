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
        :default  #: String
      )

      Read = Data.define(
        :name,      #: String
        :comparand, #: String?
        :kind       #: Symbol?
      )

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

        #: (String, Hash[String, Declaration]) -> (Read | Symbol)?
        def condition_read(expression, states)
          source = expression.strip
          parsed = expression_node(source)

          return mentions_any?(source, states) ? :computed : nil if parsed.nil?

          read = bare_read(parsed, states)
          return read if read

          equality = equality_read(parsed, states)
          return equality if equality

          mentions_any?(source, states) ? :computed : nil
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

          return Declaration.new(name: name, kind: kind, default: value.slice) if kind

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
            Declaration.new(name: name, kind: :seeded, default: value.slice)
          end
        end

        #: (String, untyped, Hash[String, Symbol]) -> Declaration
        def bare_default(name, value, locals)
          identifier = value.name.to_s

          unless value.receiver.nil? && value.arguments.nil? && value.block.nil? && BARE.match?(identifier)
            return Declaration.new(name: name, kind: :seeded, default: value.slice)
          end

          kind = locals[identifier]

          unless kind
            raise Herb::Engine::CompilationError,
                  "the state `#{name}` defaults to `#{identifier}`, which is not a declared strict local; " \
                  "a bare name that was never passed raises at render, so it has to be declared"
          end

          Declaration.new(name: name, kind: kind, default: identifier)
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

          Read.new(name: name, comparand: nil, kind: declaration.kind)
        end

        #: (untyped, Hash[String, Declaration]) -> Read?
        def equality_read(node, states)
          return nil unless node.is_a?(Prism::CallNode) && node.name == :==

          left = node.receiver
          right = node.arguments&.arguments&.first

          return nil unless left && right && node.arguments&.arguments&.one?

          read = bare_read(left, states) || bare_read(right, states)

          return nil unless read

          literal = bare_read(left, states) ? right : left
          kind = KINDS[literal.class.name]

          unless kind
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` compares the state `#{read.name}` against something that is not a literal; " \
                  "the client resolves a comparison by lookup, so the comparand has to be one"
          end

          unless kind == read.kind || kind == :nil || read.kind == :seeded
            raise Herb::Engine::CompilationError,
                  "`#{node.slice}` compares the #{read.kind.to_s.capitalize} state `#{read.name}` against a #{kind.to_s.capitalize} literal"
          end

          Read.new(name: read.name, comparand: literal.slice, kind: read.kind)
        end
      end
    end
  end
end
