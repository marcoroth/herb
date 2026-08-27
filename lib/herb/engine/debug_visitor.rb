# frozen_string_literal: true
# typed: false

require_relative "../visitor"
require_relative "context_aware"

module Herb
  class Engine
    class DebugVisitor < Herb::Visitor
      include ContextAware

      required_parser_option track_locations: true

      #: () -> bool
      def self.reads_erb_source?
        true
      end

      # `node` adds the render occurrence to every marker, which needs `InstrumentationVisitor` in the
      # same stack to have anything to report. Without it the value is empty on every tag, so it is
      # asked for rather than assumed.
      #
      #     Herb::Engine.new(source, visitors: [
      #       Herb::Engine::DebugVisitor.new(node: true),
      #       Herb::Engine::InstrumentationVisitor.new
      #     ])
      #
      def initialize(node: false)
        super()

        @node = node

        @top_level_elements = [] #: Array[Herb::AST::HTMLElementNode]
        @element_stack = [] #: Array[String]
        @erb_block_stack = [] #: Array[(Herb::AST::ERBBlockNode | Herb::AST::ERBIterationBlockNode)]
        @debug_attributes_applied = false
        @in_attribute = false
        @in_html_comment = false
        @in_html_doctype = false
        @erb_nodes_to_wrap = [] #: Array[Herb::AST::ERBContentNode]
        @top_level_elements = [] #: Array[Herb::AST::HTMLElementNode]
      end

      def visit_document_node(node)
        find_top_level_elements(node)

        super

        wrap_all_erb_nodes(node)
      end

      def visit_html_element_node(node)
        tag_name = node.tag_name&.value&.downcase
        @element_stack.push(tag_name) if tag_name

        add_debug_attributes_to_element(node.open_tag) if should_add_debug_attributes_to_element?(node.open_tag)

        super

        @element_stack.pop if tag_name
      end

      def visit_html_attribute_node(node)
        @in_attribute = true
        super
        @in_attribute = false
      end

      def visit_html_comment_node(node)
        @in_html_comment = true
        super
        @in_html_comment = false
      end

      def visit_html_doctype_node(node)
        @in_html_doctype = true
        super
        @in_html_doctype = false
      end

      def visit_erb_content_node(node)
        if !@in_attribute && !@in_html_comment && !@in_html_doctype && !in_excluded_context? && erb_output?(node.tag_opening.value)
          code = node.content.value.strip

          @erb_nodes_to_wrap << node unless complex_rails_helper?(code)
        end

        super
      end

      def visit_erb_yield_node(_node)
        nil
      end

      def visit_erb_block_node(node)
        @erb_block_stack.push(node)
        super
        @erb_block_stack.pop
      end

      def visit_erb_iteration_block_node(node)
        @erb_block_stack.push(node)
        super
        @erb_block_stack.pop
      end

      def inspect
        return "#<#{self.class.name}>" unless @node

        "#<#{self.class.name} node=true>"
      end

      private

      def filename
        context.file_path
      end

      def relative_file_path
        context.relative_file_path
      end

      def wrap_all_erb_nodes(node)
        replace_erb_nodes_recursive(node)
      end

      def replace_erb_nodes_recursive(node)
        array_properties = [:children, :body, :statements]

        array_properties.each do |prop|
          next unless node.respond_to?(prop) && node.send(prop).is_a?(Array)

          array = node.send(prop)

          array.each_with_index do |child, index|
            if @erb_nodes_to_wrap.include?(child)
              debug_span = create_debug_span_for_erb(child)
              array[index] = debug_span
            else
              replace_erb_nodes_recursive(child)
            end
          end
        end

        node_properties = [:subsequent, :else_clause, :end_node, :rescue_clause, :ensure_clause]

        node_properties.each do |prop|
          if node.respond_to?(prop) && node.send(prop)
            child_node = node.send(prop)
            replace_erb_nodes_recursive(child_node)
          end
        end
      end

      def find_top_level_elements(document_node)
        document_node.children.each do |child|
          @top_level_elements << child if child.is_a?(Herb::AST::HTMLElementNode)
        end
      end

      def should_add_debug_attributes_to_element?(open_tag_node)
        return false if @debug_attributes_applied

        parent_element = find_parent_element_for_open_tag(open_tag_node)
        return false unless parent_element

        return @top_level_elements.first == parent_element if @top_level_elements.length >= 1

        false
      end

      def find_parent_element_for_open_tag(open_tag_node)
        @top_level_elements.find { |element| element.open_tag == open_tag_node }
      end

      def add_debug_attributes_to_element(open_tag_node)
        return if @debug_attributes_applied

        view_type = determine_view_type

        debug_attributes = [
          create_debug_attribute("data-herb-debug-outline-type", view_type),
          create_debug_attribute("data-herb-debug-file-name", component_display_name),
          create_debug_attribute("data-herb-debug-file-relative-path", relative_file_path),
          create_debug_attribute("data-herb-debug-file-full-path", filename&.to_s || "unknown")
        ]

        debug_attributes << create_debug_node_attribute if @node

        if @top_level_elements.length > 1
          debug_attributes << create_debug_attribute("data-herb-debug-attach-to-parent", "true")
        end

        open_tag_node.children.concat(debug_attributes)

        @debug_attributes_applied = true
      end

      def create_debug_node_attribute
        name_literal = Herb::AST::LiteralNode.build(content: +"data-herb-debug-node")
        name_node = Herb::AST::HTMLAttributeNameNode.build(children: [name_literal])

        value_node = Herb::AST::HTMLAttributeValueNode.build(
          open_quote: Herb::Token.from(:quote, '"'),
          children: [current_node_erb],
          close_quote: Herb::Token.from(:quote, '"'),
          quoted: true
        )

        Herb::AST::HTMLAttributeNode.build(
          name: name_node,
          equals: Herb::Token.from(:equals, "="),
          value: value_node
        )
      end

      def current_node_erb
        Herb::AST::ERBContentNode.build(
          tag_opening: Herb::Token.from("TOKEN_ERB_START", "<%="),
          content: Herb::Token.from("TOKEN_ERB_CONTENT", " ::Herb::Engine::Report::Session.current_node "),
          tag_closing: Herb::Token.from("TOKEN_ERB_END", "%>"),
          valid: true
        )
      end

      def create_debug_attribute(name, value)
        name_literal = Herb::AST::LiteralNode.build(content: name.dup)
        name_node = Herb::AST::HTMLAttributeNameNode.build(children: [name_literal])

        value_literal = Herb::AST::LiteralNode.build(content: value.dup)
        value_node = Herb::AST::HTMLAttributeValueNode.build(
          open_quote: Herb::Token.from(:quote, '"'),
          children: [value_literal],
          close_quote: Herb::Token.from(:quote, '"'),
          quoted: true
        )

        Herb::AST::HTMLAttributeNode.build(
          name: name_node,
          equals: Herb::Token.from(:equals, "="),
          value: value_node
        )
      end

      def create_debug_span_for_erb(erb_node)
        opening = erb_node.tag_opening.value
        code = erb_node.content.value.strip
        erb_code = "#{opening} #{code} %>"

        return erb_node if complex_rails_helper?(code)

        position = erb_node.location&.start&.to_one_based

        escaped_erb = Herb::Engine.h(erb_code)

        outline_type = if @top_level_elements.empty?
                         "erb-output #{determine_view_type}"
                       else
                         "erb-output"
                       end

        debug_attributes = [
          create_debug_attribute("data-herb-debug-outline-type", outline_type),
          create_debug_attribute("data-herb-debug-erb", escaped_erb),
          create_debug_attribute("data-herb-debug-file-name", component_display_name),
          create_debug_attribute("data-herb-debug-file-relative-path", relative_file_path),
          create_debug_attribute("data-herb-debug-file-full-path", filename&.to_s || "unknown"),
          create_debug_attribute("data-herb-debug-inserted", "true")
        ]

        debug_attributes << create_debug_node_attribute if @node

        if position
          debug_attributes << create_debug_attribute("data-herb-debug-line", position[:line].to_s)
          debug_attributes << create_debug_attribute("data-herb-debug-column", position[:column].to_s)
        end

        debug_attributes << create_debug_attribute("style", "display: contents;")

        tag_name_token = Herb::Token.from(:tag_name, "span")

        open_tag = Herb::AST::HTMLOpenTagNode.build(
          tag_opening: Herb::Token.from(:tag_opening, "<"),
          tag_name: tag_name_token,
          tag_closing: Herb::Token.from(:tag_closing, ">"),
          children: debug_attributes
        )

        close_tag = Herb::AST::HTMLCloseTagNode.build(
          tag_opening: Herb::Token.from(:tag_opening, "</"),
          tag_name: Herb::Token.from(:tag_name, "span"),
          tag_closing: Herb::Token.from(:tag_closing, ">")
        )

        Herb::AST::HTMLElementNode.build(
          open_tag: open_tag,
          tag_name: tag_name_token,
          body: [erb_node],
          close_tag: close_tag,
          element_source: "Debug"
        )
      end

      def determine_view_type
        if component?
          "component"
        elsif partial?
          "partial"
        else
          "view"
        end
      end

      def partial?
        return false unless filename

        basename = filename.basename.to_s
        basename.start_with?("_")
      end

      def component?
        return false unless filename

        filename.to_s.match?(%r{(^|/)app/components/})
      end

      def sidecar_component?
        return false unless component?
        return false unless filename

        filename.basename.to_s.match?(/\Acomponent\.(html\.erb|html\.herb|erb|herb)\z/)
      end

      def component_display_name
        return filename&.basename&.to_s || "unknown" unless filename

        basename = filename.basename.to_s
        path = filename.to_s

        if sidecar_component? && (match = path.match(%r{/components/(.+)/component\.[^/]+\z}))
          return match[1].split("/").map { |s| classify(s) }.join("::")
        end

        if component?
          path_without_ext = path.sub(/\.(?:html\.erb|html\.herb|erb|herb)\z/, "")

          if (match = path_without_ext.match(%r{/components/(.+)\z}))
            return match[1].split("/").map { |s| classify(s) }.join("::")
          end
        end

        basename
      end

      def classify(name)
        if name.respond_to?(:camelize)
          name.camelize
        else
          name.split(/[_-]/).map(&:capitalize).join
        end
      end

      def in_head_context?
        @element_stack.include?("head")
      end

      def in_script_or_style_context?
        ["script", "style"].include?(@element_stack.last)
      end

      def in_excluded_context?
        excluded_tags = ["script", "style", "head", "title", "textarea", "pre", "svg", "math"]
        return true if excluded_tags.any? { |tag| @element_stack.include?(tag) }

        if @erb_block_stack.any? { |node| javascript_tag?(node.content.value.strip) || include_debug_disable_comment?(node.content.value.strip) }
          return true
        end

        false
      end

      # TODO: Rewrite using Prism Nodes once available
      def complex_rails_helper?(code)
        cleaned_code = code.strip.gsub(/\s+/, " ")

        return true if cleaned_code.match?(/\bturbo_frame_tag\s*[(\s]/)

        return true if cleaned_code.match?(/\blink_to\s.*\s+do\s*$/) ||
                       cleaned_code.match?(/\blink_to\s.*\{\s*$/) ||
                       cleaned_code.match?(/\blink_to\s.*\s+do\s*\|/) ||
                       cleaned_code.match?(/\blink_to\s.*\{\s*\|/)

        return true if cleaned_code.match?(/\brender[\s(]/)

        return true if cleaned_code.match?(/\bform_with\s.*\s+do\s*[|$]/) ||
                       cleaned_code.match?(/\bform_with\s.*\{\s*[|$]/)

        return true if cleaned_code.match?(/\bcontent_for\s.*\s+do\s*$/) ||
                       cleaned_code.match?(/\bcontent_for\s.*\{\s*$/)

        return true if cleaned_code.match?(/\bcontent_tag\s.*\s+do\s*$/) ||
                       cleaned_code.match?(/\bcontent_tag\s.*\{\s*$/)

        return true if cleaned_code.match?(/\bcontent_tag\(.*\s+do\s*$/) ||
                       cleaned_code.match?(/\bcontent_tag\(.*\{\s*$/)

        return true if cleaned_code.match?(/\btag\.\w+\s.*do\s*$/) ||
                       cleaned_code.match?(/\btag\.\w+\s.*\{\s*$/)

        false
      end

      # TODO: Rewrite using Prism Nodes once available
      def javascript_tag?(code)
        cleaned_code = code.strip.gsub(/\s+/, " ")

        return true if cleaned_code.match?(/\bjavascript_tag\s.*do\s*$/) ||
                       cleaned_code.match?(/\bjavascript_tag\s.*\{\s*$/) ||
                       cleaned_code.match?(/\bjavascript_tag\(.*do\s*$/) ||
                       cleaned_code.match?(/\bjavascript_tag\(.*\{\s*$/)

        false
      end

      def include_debug_disable_comment?(code)
        cleaned_code = code.strip.gsub(/\s+/, " ")

        return true if cleaned_code.match?(/#\s*herb:debug\sdisable\s*$/)

        false
      end
    end
  end
end
