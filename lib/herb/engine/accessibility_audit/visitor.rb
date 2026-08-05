# frozen_string_literal: true
# typed: false

require_relative "../accessibility_audit"

module Herb
  class Engine
    module AccessibilityAudit
      # Rewrites the template AST so accessibility concerns that only exist once ERB has produced a
      # value get checked while the template renders.
      #
      # Static analysis can tell that `<img alt="<%= caption %>">` has an `alt` attribute, but not
      # whether `caption` renders blank; it can tell that `<a><%= label %></a>` has content, but not
      # whether that content is empty or reads "click here". This visitor instruments exactly those
      # spots, and leaves everything a linter can already see alone.
      #
      # Two kinds of instrumentation are inserted:
      #
      #   1. Attribute values that are a single ERB output get wrapped in
      #      `AccessibilityAudit.attribute(...)`, which returns the value unchanged.
      #
      #   2. Elements whose accessible name can only come from ERB (no static text anywhere in the
      #      subtree) get a `push_name` / `pop_name` pair around their body, and every ERB output in
      #      between is wrapped in `name_part(...)` so the audit sees the text that was rendered.
      class Visitor < Herb::Visitor
        RUNTIME = "::Herb::Engine::AccessibilityAudit"

        EXCLUDED_ANCESTORS = ["script", "style", "svg", "math", "template", "noscript"].freeze

        HIDDEN_ROLES = ["presentation", "none"].freeze

        LABELLING_ATTRIBUTES = ["aria-label", "aria-labelledby", "title"].freeze

        #: (?file_path: (String | ::Pathname)?, ?project_path: (String | ::Pathname)?, ?checks: (Symbol | Array[Symbol])) -> void
        def initialize(file_path: nil, project_path: nil, checks: :all)
          super()

          @filename = case file_path
                      when ::Pathname
                        file_path
                      when String
                        file_path.empty? ? nil : ::Pathname.new(file_path)
                      end

          @project_path = case project_path
                          when ::Pathname
                            project_path
                          when String
                            ::Pathname.new(project_path)
                          else
                            ::Pathname.new(Dir.pwd)
                          end

          @relative_file_path = calculate_relative_path
          @checks = checks == :all ? Checks::ALL : Array(checks)
          @element_stack = [] #: Array[String]

          generated = {} #: Hash[Herb::AST::Node, bool]
          @generated = generated.compare_by_identity
        end

        def visit_html_element_node(node)
          tag_name = node.tag_name&.value&.downcase

          if tag_name.nil?
            super

            return
          end

          auditable = !excluded_context?

          instrument_attributes(node.open_tag, tag_name) if auditable

          @element_stack.push(tag_name)
          super
          @element_stack.pop

          instrument_content(node, tag_name) if auditable
        end

        private

        #: () -> String
        def calculate_relative_path
          return "unknown" unless @filename

          if @filename.absolute?
            @filename.relative_path_from(@project_path).to_s
          else
            @filename.to_s
          end
        rescue ArgumentError
          @filename.to_s
        end

        #: () -> bool
        def excluded_context?
          @element_stack.any? { |tag| EXCLUDED_ANCESTORS.include?(tag) }
        end

        #: (Herb::AST::Node?, String) -> void
        def instrument_attributes(open_tag, tag_name)
          return unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

          open_tag.children.each do |attribute|
            next unless attribute.is_a?(Herb::AST::HTMLAttributeNode)

            attribute_name = static_attribute_name(attribute)
            next unless attribute_name

            checks = AccessibilityAudit.attribute_checks(tag_name, attribute_name) & @checks
            next if checks.empty?

            value = attribute.value
            next unless value

            erb_node = single_erb_output(value.children)
            next unless erb_node && instrumentable?(erb_node)

            value.children[0] = audited_attribute_node(erb_node, tag_name, attribute_name)
          end
        end

        #: (Herb::AST::HTMLElementNode, String) -> void
        def instrument_content(node, tag_name)
          return if node.is_void

          checks = AccessibilityAudit.content_checks(tag_name) & @checks
          return if checks.empty?

          return if statically_named?(node.open_tag)
          return if static_text?(node.body)
          return unless dynamic_content?(node.body)

          instrument_name_parts(node.body)

          node.body.unshift(code_node(node, "#{RUNTIME}.push_name"))
          node.body.push(code_node(node, pop_name_code(node, tag_name)))
        end

        #: (Array[Herb::AST::Node]) -> void
        def instrument_name_parts(nodes)
          nodes.each_with_index do |child, index|
            if child.is_a?(Herb::AST::ERBContentNode) && erb_output_node?(child)
              nodes[index] = audited_name_part_node(child) if instrumentable?(child)
            else
              child_nodes(child).each { |array| instrument_name_parts(array) }
            end
          end
        end

        #: (Herb::AST::Node) -> Array[Array[Herb::AST::Node]]
        def child_nodes(node)
          arrays = [] #: Array[Array[Herb::AST::Node]]

          [:body, :statements].each do |property|
            next unless node.respond_to?(property)

            array = node.send(property)
            arrays << array if array.is_a?(Array)
          end

          [:subsequent, :else_clause, :end_node, :rescue_clause, :ensure_clause].each do |property|
            next unless node.respond_to?(property)

            child = node.send(property)
            arrays.concat(child_nodes(child)) if child.is_a?(Herb::AST::Node)
          end

          arrays
        end

        #: (Array[Herb::AST::Node]) -> bool
        def static_text?(nodes)
          nodes.any? do |node|
            case node
            when Herb::AST::HTMLTextNode, Herb::AST::LiteralNode
              !node.content.to_s.strip.empty?
            when Herb::AST::HTMLElementNode
              statically_named?(node.open_tag) || static_text?(node.body)
            else
              child_nodes(node).any? { |array| static_text?(array) }
            end
          end
        end

        #: (Array[Herb::AST::Node]) -> bool
        def dynamic_content?(nodes)
          nodes.any? do |node|
            erb_output_node?(node) || child_nodes(node).any? { |array| dynamic_content?(array) }
          end
        end

        #: (Herb::AST::Node?) -> bool
        def statically_named?(open_tag)
          return false unless open_tag.is_a?(Herb::AST::HTMLOpenTagNode)

          open_tag.children.any? do |attribute|
            next false unless attribute.is_a?(Herb::AST::HTMLAttributeNode)

            name = static_attribute_name(attribute)
            next false unless name

            value = static_attribute_value(attribute)

            case name
            when *LABELLING_ATTRIBUTES
              value.nil? || !value.strip.empty?
            when "aria-hidden"
              value == "true"
            when "role"
              HIDDEN_ROLES.include?(value)
            else
              false
            end
          end
        end

        #: (Herb::AST::HTMLAttributeNode) -> String?
        def static_attribute_name(node)
          children = node.name&.children
          return nil unless children&.any?

          literals(children)&.join&.downcase
        end

        #: (Herb::AST::HTMLAttributeNode) -> String?
        def static_attribute_value(node)
          children = node.value&.children
          return nil unless children
          return "" if children.empty?

          literals(children)&.join
        end

        #: (Array[Herb::AST::Node]) -> Array[String]?
        def literals(children)
          contents = children.grep(Herb::AST::LiteralNode) #: Array[Herb::AST::LiteralNode]

          return nil unless contents.length == children.length

          contents.map { |literal| literal.content.to_s }
        end

        #: (Array[Herb::AST::Node]) -> Herb::AST::ERBContentNode?
        def single_erb_output(children)
          return nil unless children.length == 1

          node = children.first

          return nil unless node.is_a?(Herb::AST::ERBContentNode)
          return nil unless erb_output_node?(node)

          node
        end

        #: (Herb::AST::Node?) -> bool
        def erb_output_node?(node)
          node.is_a?(Herb::AST::ERBContentNode) && erb_output?(node.tag_opening&.value.to_s)
        end

        #: (String) -> bool
        def erb_output?(opening)
          opening.include?("=") && !opening.include?("#")
        end

        #: (Herb::AST::ERBContentNode) -> bool
        def instrumentable?(node)
          return false if @generated.key?(node)

          code = node.content&.value.to_s.strip

          return false if code.empty?
          return false if Herb::Engine.heredoc?(code)
          return false if block_opening?(code)

          true
        end

        #: (String) -> bool
        def block_opening?(code)
          code.match?(/(\bdo|\{)(\s*\|[^|]*\|)?\s*\z/)
        end

        #: (Herb::AST::ERBContentNode, String, String) -> Herb::AST::ERBContentNode
        def audited_attribute_node(node, tag_name, attribute_name)
          code = <<~RUBY.strip
            #{RUNTIME}.attribute((#{expression(node)}), element: #{tag_name.inspect}, attribute: #{attribute_name.inspect}, #{source_arguments(node)})
          RUBY

          erb_node(node, node.tag_opening, code, node.tag_closing)
        end

        #: (Herb::AST::ERBContentNode) -> Herb::AST::ERBContentNode
        def audited_name_part_node(node)
          erb_node(node, node.tag_opening, "#{RUNTIME}.name_part((#{expression(node)}))", node.tag_closing)
        end

        #: (Herb::AST::HTMLElementNode, String) -> String
        def pop_name_code(node, tag_name)
          "#{RUNTIME}.pop_name(element: #{tag_name.inspect}, #{source_arguments(node)})"
        end

        #: (Herb::AST::ERBContentNode) -> String
        def expression(node)
          code = node.content&.value.to_s.strip

          Herb::Engine.comment?(code) ? "#{code}\n" : code
        end

        #: (Herb::AST::Node) -> String
        def source_arguments(node)
          line = node.location&.start&.line
          column = node.location&.start&.column

          arguments = ["file: #{(@relative_file_path || "unknown").inspect}"]
          arguments << "line: #{line}" if line
          arguments << "column: #{column + 1}" if column

          arguments.join(", ")
        end

        #: (Herb::AST::Node, String) -> Herb::AST::ERBContentNode
        def code_node(node, code)
          erb_node(node, create_token(:erb_start, "<%"), code, create_token(:erb_end, "%>"))
        end

        #: (Herb::AST::Node, untyped, String, untyped) -> Herb::AST::ERBContentNode
        def erb_node(node, tag_opening, code, tag_closing)
          prism_node = nil #: untyped

          generated = Herb::AST::ERBContentNode.new(
            "ERBContentNode",
            node.location,
            [],
            tag_opening,
            create_token(:erb_content, " #{code} "),
            tag_closing,
            nil,
            false,
            true,
            prism_node
          )

          @generated[generated] = true

          generated
        end

        #: (Symbol, String) -> Herb::Token
        def create_token(type, value)
          Herb::Token.new(value.dup, Herb::Range.from(0, 0), Herb::Location.from(0, 0, 0, 0), type.to_s)
        end
      end
    end
  end
end
