# frozen_string_literal: true

module Herb
  class Engine
    class DebugVisitor < Herb::Visitor
      def initialize(engine)
        super()

        @engine = engine
        @top_level_elements = [] #: Array[Herb::AST::HTMLElementNode]
        @element_stack = [] #: Array[String]
        @debug_attributes_applied = false
        @in_attribute = false
        @in_html_comment = false
        @in_html_doctype = false
        @erb_nodes_to_wrap = [] #: Array[Herb::AST::ERBContentNode]
      end

      def debug_enabled?
        @engine.debug
      end

      def visit_document_node(node)
        return unless debug_enabled?

        find_top_level_elements(node)

        super

        wrap_all_erb_nodes(node)
      end

      def visit_html_element_node(node)
        return super unless debug_enabled?

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
        if debug_enabled? && !@in_attribute && !@in_html_comment && !@in_html_doctype && !in_excluded_context? && erb_output?(node.tag_opening.value)
          code = node.content.value.strip

          @erb_nodes_to_wrap << node unless complex_rails_helper?(code)
        end

        super
      end

      def visit_erb_yield_node(_node)
        nil
      end

      private

      def wrap_all_erb_nodes(node)
        replace_erb_nodes_recursive(node)
      end

      # Creates a dummy location for AST nodes that don't need real location info
      #: () -> Herb::Location
      def dummy_location
        @dummy_location ||= Herb::Location.from(0, 0, 0, 0)
      end

      # Creates a dummy range for tokens that don't need real range info
      #: () -> Herb::Range
      def dummy_range
        @dummy_range ||= Herb::Range.from(0, 0)
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
        @top_level_elements = [] #: Array[Herb::AST::HTMLElementNode]

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
          create_debug_attribute("data-herb-debug-file-name", @engine.filename&.basename&.to_s || "unknown"),
          create_debug_attribute("data-herb-debug-file-relative-path", @engine.relative_file_path || ""),
          create_debug_attribute("data-herb-debug-file-full-path", @engine.filename&.to_s || "unknown")
        ]

        if @top_level_elements.length > 1
          debug_attributes << create_debug_attribute("data-herb-debug-attach-to-parent", "true")
        end

        debug_attributes.each do |attr|
          open_tag_node.children << attr
        end

        @debug_attributes_applied = true
      end

      def create_debug_attribute(name, value)
        name_literal = Herb::AST::LiteralNode.new("LiteralNode", dummy_location, [], name.dup)
        name_node = Herb::AST::HTMLAttributeNameNode.new("HTMLAttributeNameNode", dummy_location, [], [name_literal])

        value_literal = Herb::AST::LiteralNode.new("LiteralNode", dummy_location, [], value.dup)
        value_node = Herb::AST::HTMLAttributeValueNode.new("HTMLAttributeValueNode", dummy_location, [], create_token(:quote, '"'),
                                                           [value_literal], create_token(:quote, '"'), true)

        equals_token = create_token(:equals, "=")

        Herb::AST::HTMLAttributeNode.new("HTMLAttributeNode", dummy_location, [], name_node, equals_token, value_node)
      end

      def create_token(type, value)
        Herb::Token.new(value.dup, dummy_range, dummy_location, type.to_s)
      end

      def create_debug_span_for_erb(erb_node)
        opening = erb_node.tag_opening.value
        code = erb_node.content.value.strip
        erb_code = "#{opening} #{code} %>"

        return erb_node if complex_rails_helper?(code)

        line = erb_node.location&.start&.line
        column = erb_node.location&.start&.column

        escaped_erb = erb_code.gsub("&", "&amp;").gsub("<", "&lt;").gsub(">", "&gt;").gsub('"', "&quot;").gsub("'",
                                                                                                               "&#39;")

        outline_type = if @top_level_elements.empty?
                         "erb-output #{determine_view_type}"
                       else
                         "erb-output"
                       end

        debug_attributes = [
          create_debug_attribute("data-herb-debug-outline-type", outline_type),
          create_debug_attribute("data-herb-debug-erb", escaped_erb),
          create_debug_attribute("data-herb-debug-file-name", @engine.filename&.basename.to_s),
          create_debug_attribute("data-herb-debug-file-relative-path", @engine.relative_file_path || ""),
          create_debug_attribute("data-herb-debug-file-full-path", @engine.filename.to_s),
          create_debug_attribute("data-herb-debug-inserted", "true")
        ]

        debug_attributes << create_debug_attribute("data-herb-debug-line", line.to_s) if line

        debug_attributes << create_debug_attribute("data-herb-debug-column", (column + 1).to_s) if column

        debug_attributes << create_debug_attribute("style", "display: contents;")

        tag_name_token = create_token(:tag_name, "span")

        open_tag = Herb::AST::HTMLOpenTagNode.new(
          "HTMLOpenTagNode",
          dummy_location,
          [],
          create_token(:tag_opening, "<"),
          tag_name_token,
          create_token(:tag_closing, ">"),
          debug_attributes,
          false
        )

        close_tag = Herb::AST::HTMLCloseTagNode.new(
          "HTMLCloseTagNode",
          dummy_location,
          [],
          create_token(:tag_opening, "</"),
          create_token(:tag_name, "span"),
          [],
          create_token(:tag_closing, ">")
        )

        Herb::AST::HTMLElementNode.new("HTMLElementNode", dummy_location, [], open_tag, tag_name_token, [erb_node], close_tag,
                                       false)
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
        return false unless @engine.filename

        basename = @engine.filename.basename.to_s
        basename.start_with?("_")
      end

      def component?
        return false unless @engine.filename

        path = @engine.filename.to_s
        path.include?("/components/")
      end

      def in_head_context?
        @element_stack.include?("head")
      end

      def in_script_or_style_context?
        ["script", "style"].include?(@element_stack.last)
      end

      def in_excluded_context?
        excluded_tags = ["script", "style", "head", "textarea", "pre"]
        excluded_tags.any? { |tag| @element_stack.include?(tag) }
      end

      def erb_output?(opening)
        opening.include?("=") && !opening.include?("#")
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
    end
  end
end
