# frozen_string_literal: true
# typed: false

require_relative "../visitor"
require_relative "context_aware"

module Herb
  class Engine
    # Wraps every ERB tag in a call that says which tag is rendering, so that whatever happens
    # while it renders can be attributed to it rather than to the template as a whole.
    #
    # This is half of a mechanism and does nothing by itself. It supplies where, and something else
    # has to supply what. A template compiled with it and rendered with nothing watching records no
    # entries at all, and only costs a call per tag. What makes it worth having is anything that
    # calls `Herb::Engine::Report::Session.observe` while a tag is rendering:
    #
    #     require "herb/engine/instrumentation_visitor"
    #
    #     engine = Herb::Engine.new(source, visitors: [Herb::Engine::InstrumentationVisitor.new])
    #
    #     ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
    #       Herb::Engine::Report::Session.observe(:queries, payload[:sql]) unless payload[:cached]
    #     end
    #
    #     session = Herb::Engine::Report::Session.capture { render(engine.src) }
    #
    #     session.measure(:queries, origin: "Herb Engine", code: "sql-queries") do |queries|
    #       "#{queries.size} SQL queries"
    #     end
    #     #=> app/views/posts/_card.html.erb:7:8: [sql-queries] 3 SQL queries
    #
    # Nothing about that subscription is Herb's, which is the point. Because what gets watched is
    # decided at render time rather than compiled in, adding a producer never means recompiling a
    # template, and Herb never has to ship a class per thing worth watching.
    #
    # A tag that opens a block, or that assigns to a local, is framed from the outside rather than
    # wrapped, because wrapping either one would change what the template means: a block would lose
    # its body, and an assignment would bind inside the wrapper instead of the template.
    class InstrumentationVisitor < Herb::Visitor
      include ContextAware

      SESSION = "::Herb::Engine::Report::Session"

      ASSIGNMENT_NODES = [
        :LocalVariableWriteNode,
        :LocalVariableOperatorWriteNode,
        :LocalVariableOrWriteNode,
        :LocalVariableAndWriteNode,
        :MultiWriteNode
      ].freeze

      ARRAY_PROPERTIES = [:children, :body, :statements].freeze
      NODE_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze

      # @rbs!
      #   def self.experimental_warning_issued: () -> bool
      #   def self.experimental_warning_issued=: (bool) -> bool

      class << self
        attr_accessor :experimental_warning_issued #: bool
      end

      self.experimental_warning_issued = false

      def initialize
        super

        return if self.class.experimental_warning_issued

        self.class.experimental_warning_issued = true

        warn "[Herb] Instrumentation is experimental as it instruments every ERB tag."
      end

      def visit_document_node(node)
        super

        instrument(node)

        frame_render(node)
      end

      def inspect
        "#<#{self.class.name}>"
      end

      private

      def frame_render(node)
        template = context.relative_file_path.dump

        node.children.unshift(erb_node(node, "<%", "#{SESSION}.enter_render(#{template}); begin"))
        node.children.push(erb_node(node, "<%", "ensure; #{SESSION}.leave_render; end"))

        nil
      end

      def instrument(node)
        ARRAY_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property).is_a?(Array)

          rewrite(node.send(property))
        end

        NODE_PROPERTIES.each do |property|
          next unless node.respond_to?(property) && node.send(property)

          instrument(node.send(property))
        end
      end

      def rewrite(nodes)
        rewritten = nodes.flat_map { |node|
          instrument(node)

          if framed?(node)
            [enter_node(node), node, leave_node(node)]
          elsif output?(node)
            [wrapped_output(node)]
          elsif statement?(node)
            [wrapped_statement(node)]
          else
            [node]
          end
        }

        nodes.replace(rewritten)
      end

      def output?(node)
        node.is_a?(Herb::AST::ERBContentNode) && opening(node).start_with?("<%=")
      end

      def statement?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)

        opening = opening(node)

        opening.start_with?("<%") && !opening.start_with?("<%=", "<%#")
      end

      def framed?(node)
        block?(node) || (output?(node) && assignment?(node))
      end

      def assignment?(node)
        return false unless node.respond_to?(:parsed_prism_node)
        return false unless defined?(::Prism)

        parsed = node.parsed_prism_node

        return false unless parsed

        ASSIGNMENT_NODES.any? { |name| ::Prism.const_defined?(name) && parsed.is_a?(::Prism.const_get(name)) }
      rescue StandardError
        false
      end

      def block?(node)
        return false if node.is_a?(Herb::AST::ERBRenderNode)
        return false unless node.respond_to?(:end_node)

        !node.end_node.nil?
      end

      def opening(node)
        return "" unless node.respond_to?(:tag_opening)

        node.tag_opening&.value.to_s
      end

      def wrapped_output(node)
        erb_node(node, "<%=", "#{SESSION}.at(#{position(node)}) {\n#{code(node)}\n}")
      end

      def wrapped_statement(node)
        erb_node(node, "<%", "#{SESSION}.enter(#{position(node)}); begin\n#{code(node)}\nensure; #{SESSION}.leave; end")
      end

      def enter_node(node)
        erb_node(node, "<%", "#{SESSION}.enter(#{position(node)})")
      end

      def leave_node(node)
        erb_node(node, "<%", "#{SESSION}.leave")
      end

      def position(node)
        location = node.location

        [context.relative_file_path.dump, location.start.line, location.start.column].join(", ")
      end

      def code(node)
        return "" unless node.respond_to?(:content)

        node.content&.value.to_s.strip
      end

      def erb_node(node, opening, code)
        Herb::AST::ERBContentNode.new(
          "ERBContentNode",
          node.location,
          [],
          Herb::Token.from("TOKEN_ERB_START", opening),
          Herb::Token.from("TOKEN_ERB_CONTENT", " #{code} "),
          Herb::Token.from("TOKEN_ERB_END", "%>"),
          nil,
          false,
          true,
          nil
        )
      end
    end
  end
end
