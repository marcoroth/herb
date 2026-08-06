# frozen_string_literal: true

require_relative "../../herb"

module Herb
  class Engine
    # Wraps every ERB tag in a call that records which tag is rendering, so that queries can be
    # attributed to the exact tag that caused them.
    #
    # This visitor is not loaded by default and only rewrites the AST. Reporting is left to
    # `Herb::Engine::QueryTracker`, which is what actually subscribes to the queries.
    #
    #     require "herb/engine/query_tracker_visitor"
    #
    #     Herb::Engine.new(source, visitors: [Herb::Engine::QueryTrackerVisitor.new])
    #
    class QueryTrackerVisitor < Herb::Visitor
      TRACKER = "::Herb::Engine::QueryTracker"

      ARRAY_PROPERTIES = [:children, :body, :statements].freeze
      NODE_PROPERTIES = [:subsequent, :else_clause, :rescue_clause, :ensure_clause].freeze

      # @rbs!
      #   def self.experimental_warning_issued: () -> bool
      #   def self.experimental_warning_issued=: (bool) -> bool

      class << self
        attr_accessor :experimental_warning_issued #: bool
      end

      self.experimental_warning_issued = false

      #: (?filename: String?) -> void
      def initialize(filename: nil)
        super()

        @filename = filename

        return if self.class.experimental_warning_issued

        self.class.experimental_warning_issued = true

        warn "[Herb] The Query Tracker is experimental. It instruments every ERB tag and is not meant for production."
      end

      def visit_document_node(node)
        super

        instrument(node)
      end

      #: () -> String
      def inspect
        "#<#{self.class.name}>"
      end

      private

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

          if output?(node)
            [wrapped_output(node)]
          elsif statement?(node)
            [wrapped_statement(node)]
          elsif block?(node)
            [enter_node(node), node, leave_node(node)]
          else
            [node]
          end
        }

        nodes.replace(rewritten)
      end

      #: (Herb::AST::Node) -> bool
      def output?(node)
        node.is_a?(Herb::AST::ERBContentNode) && opening(node).start_with?("<%=")
      end

      #: (Herb::AST::Node) -> bool
      def statement?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)

        opening = opening(node)

        opening.start_with?("<%") && !opening.start_with?("<%=", "<%#")
      end

      #: (Herb::AST::Node) -> bool
      def block?(node)
        return false if node.is_a?(Herb::AST::ERBRenderNode)
        return false unless node.respond_to?(:end_node)

        !node.end_node.nil? # steep:ignore
      end

      #: (Herb::AST::Node) -> String
      def opening(node)
        return "" unless node.respond_to?(:tag_opening)

        node.tag_opening&.value.to_s # steep:ignore
      end

      def wrapped_output(node)
        erb_node(node, "<%=", "#{TRACKER}.at(#{position(node)}) { #{code(node)} }")
      end

      def wrapped_statement(node)
        erb_node(node, "<%", "#{TRACKER}.enter(#{position(node)}); #{code(node)}; #{TRACKER}.leave")
      end

      def enter_node(node)
        erb_node(node, "<%", "#{TRACKER}.enter(#{position(node)})")
      end

      def leave_node(node)
        erb_node(node, "<%", "#{TRACKER}.leave")
      end

      #: (Herb::AST::Node) -> String
      def position(node)
        location = node.location

        [@filename&.dump || "nil", location.start.line, location.start.column].join(", ")
      end

      #: (Herb::AST::Node) -> String
      def code(node)
        return "" unless node.respond_to?(:content)

        node.content&.value.to_s.strip # steep:ignore
      end

      #: (Herb::AST::Node, String, String) -> Herb::AST::ERBContentNode
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
