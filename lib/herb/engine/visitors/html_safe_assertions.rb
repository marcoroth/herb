# frozen_string_literal: true
# typed: false

require_relative "../../../herb"
require_relative "../runtime/html_safe_assertions"

begin
  require "prism"
rescue LoadError
  raise LoadError,
        "Herb::Engine::Visitors::HTMLSafeAssertions requires the `prism` gem. " \
        "Add it to your Gemfile or install it with: gem install prism"
end

module Herb
  class Engine
    module Visitors
      # Wraps the receiver of every `.html_safe` call in a template with a runtime assertion, so
      # that marking a value as HTML-safe raises when the value contains HTML that the browser
      # executes.
      #
      # This visitor is not loaded by default. Require it explicitly and pass it to the engine:
      #
      #     require "herb/engine/visitors/html_safe_assertions"
      #
      #     Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::HTMLSafeAssertions.new])
      #
      # `<%= @user.bio.html_safe %>` then compiles as if the template had been written as:
      #
      #     <%= ::Herb::Engine::Runtime::HTMLSafeAssertions.check(@user.bio, file: __FILE__, line: 1, column: 1, source: "<%= @user.bio.html_safe %>", mode: :raise).html_safe %>
      #
      # The assertion runs on every render, and the value keeps flowing through `.html_safe`
      # unchanged. See `Herb::Engine::Runtime::HTMLSafeAssertions` for what counts as unsafe.
      #
      # The calls are found in the Prism program the parser attaches to the document, which the
      # engine enables through `required_parser_option`. Parsing an AST for this visitor by hand
      # needs the same option:
      #
      #     Herb.parse(source, prism_program: true)
      #
      class HTMLSafeAssertions < Herb::Visitor
        include Herb::Visitor::ContextAware

        required_parser_option track_locations: true

        RUNTIME = "::Herb::Engine::Runtime::HTMLSafeAssertions"

        MAX_SOURCE_LENGTH = 120

        required_parser_option prism_program: true

        class MissingPrismProgramError < StandardError
        end

        #: (?mode: Symbol, ?ignore: Array[Symbol], ?file_path: (String | ::Pathname)?) -> void
        def initialize(mode: :raise, ignore: [], file_path: nil)
          super()

          @mode = validated_mode(mode)
          @ignore = validated_ignore(ignore)
          @erb_nodes = [] #: Array[untyped]

          self.context = Context.new(file_path: file_path) if file_path
        end

        #: (Herb::AST::DocumentNode) -> void
        def visit_document_node(node)
          @erb_nodes = [] #: Array[untyped]

          super

          add_assertions(node)
        end

        #: (Herb::AST::Node) -> void
        def visit_erb_node(node)
          @erb_nodes << node if content_token(node)
        end

        #: () -> String
        def inspect
          "#<#{self.class.name} mode=#{@mode.inspect} ignore=#{@ignore.inspect} file_path=#{context.file_path&.to_s.inspect}>"
        end

        private

        #: (Symbol) -> Symbol
        def validated_mode(mode)
          return mode if Engine::Runtime::HTMLSafeAssertions::MODES.include?(mode)

          raise ArgumentError,
                "mode must be one of #{Engine::Runtime::HTMLSafeAssertions::MODES.map(&:inspect).join(", ")}, got #{mode.inspect}"
        end

        #: (Array[Symbol]) -> Array[Symbol]
        def validated_ignore(ignore)
          names = ignore.map(&:to_sym)
          unknown = names - Engine::Runtime::HTMLSafeAssertions::CHECK_NAMES

          return names if unknown.empty?

          raise ArgumentError,
                "unknown check #{unknown.map(&:inspect).join(", ")}, expected one of #{Engine::Runtime::HTMLSafeAssertions::CHECK_NAMES.map(&:inspect).join(", ")}"
        end

        #: (Herb::AST::DocumentNode) -> void
        def add_assertions(document)
          targets = html_safe_targets(document)

          return if targets.empty?

          @erb_nodes.each { |node| rewrite(node, targets) }
        end

        #: (Herb::AST::DocumentNode) -> Array[[Symbol, Prism::Location]]
        def html_safe_targets(document)
          program = document.deserialized_prism_node

          unless program.is_a?(Prism::ProgramNode)
            raise MissingPrismProgramError,
                  "#{self.class.name} needs the document to be parsed with the `prism_program` parser option. " \
                  "Pass the visitor to `Herb::Engine`, which enables it, or parse with `Herb.parse(source, prism_program: true)`."
          end

          targets = [] #: Array[[Symbol, Prism::Location]]
          queue = [program] #: Array[Prism::Node]

          until queue.empty?
            current = queue.shift

            queue.concat(current.compact_child_nodes)

            target = target_for(current)

            targets << target if target
          end

          targets
        end

        #: (Prism::Node) -> [Symbol, Prism::Location]?
        def target_for(node)
          if node.is_a?(Prism::CallNode) && html_safe_call?(node)
            receiver = node.receiver

            return [:receiver, receiver.location] if receiver
          end

          if node.is_a?(Prism::BlockArgumentNode) && html_safe_symbol?(node)
            expression = node.expression

            return [:symbol_to_proc, expression.location] if expression
          end

          nil
        end

        #: (Prism::CallNode) -> bool
        def html_safe_call?(node)
          return false unless node.name == :html_safe
          return false unless node.receiver
          return false if node.arguments || node.block

          true
        end

        #: (Prism::BlockArgumentNode) -> bool
        def html_safe_symbol?(node)
          expression = node.expression

          expression.is_a?(Prism::SymbolNode) && expression.unescaped == "html_safe"
        end

        #: (untyped, Array[[Symbol, Prism::Location]]) -> void
        def rewrite(node, targets)
          token = content_token(node)

          return unless token

          code = token.value

          return unless code.include?("html_safe")

          range = token.range

          return unless range
          return unless range.to - range.from == code.bytesize

          local = targets.filter_map { |kind, location| local_target(kind, location, range) }

          return if local.empty?

          arguments = check_arguments(node, code)
          rewritten = code

          edits(local, arguments).each do |start_offset, end_offset, text|
            rewritten = splice(rewritten, start_offset, end_offset, text)
          end

          token.value.replace(rewritten)
        end

        #: (Symbol, Prism::Location, Herb::Range) -> [Symbol, Integer, Integer]?
        def local_target(kind, location, range)
          return nil unless location.start_offset >= range.from
          return nil unless location.end_offset <= range.to

          [kind, location.start_offset - range.from, location.end_offset - range.from]
        end

        #: (Array[[Symbol, Integer, Integer]], String) -> Array[[Integer, Integer, String]]
        def edits(targets, arguments)
          edits = [] #: Array[[Integer, Integer, String]]

          targets.each do |kind, start_offset, end_offset|
            if kind == :symbol_to_proc
              edits << [start_offset, end_offset, "->(value, *rest) { #{RUNTIME}.check(value#{arguments}).html_safe(*rest) }"]

              next
            end

            edits << [end_offset, end_offset, "#{arguments})"]
            edits << [start_offset, start_offset, "#{RUNTIME}.check("]
          end

          edits.sort_by { |start_offset, _end_offset, _text| -start_offset }
        end

        #: (String, Integer, Integer, String) -> String
        def splice(string, start_offset, end_offset, text)
          "#{string.byteslice(0, start_offset)}#{text}#{string.byteslice(end_offset..-1)}"
        end

        #: (untyped) -> Herb::Token?
        def content_token(node)
          token = node.respond_to?(:content) ? node.content : nil

          token.is_a?(Herb::Token) ? token : nil
        end

        #: (untyped, String) -> String
        def check_arguments(node, code)
          parts = ["file: #{file_argument}"] #: Array[String]

          location = node.location

          if location
            position = location.start.to_one_based

            parts << "line: #{position[:line]}"
            parts << "column: #{position[:column]}"
          end

          parts << "source: #{erb_source(node, code).dump}.freeze"
          parts << "mode: #{@mode.inspect}"
          parts << "ignore: #{@ignore.inspect}.freeze" if @ignore.any?

          ", #{parts.join(", ")}"
        end

        #: () -> String
        def file_argument
          return "__FILE__" unless context.file_path

          "#{context.relative_file_path.dump}.freeze"
        end

        #: (untyped, String) -> String
        def erb_source(node, code)
          opening = node.respond_to?(:tag_opening) ? node.tag_opening&.value : nil
          closing = node.respond_to?(:tag_closing) ? node.tag_closing&.value : nil

          truncate("#{opening}#{code}#{closing}")
        end

        #: (String) -> String
        def truncate(string)
          string.length > MAX_SOURCE_LENGTH ? "#{string[0, MAX_SOURCE_LENGTH]}..." : string
        end
      end
    end
  end
end
