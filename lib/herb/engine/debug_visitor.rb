# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    class DebugVisitor < Herb::Visitor
      def initialize(file_path: nil, project_path: nil)
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
        @top_level_elements = [] #: Array[Herb::AST::HTMLElementNode]
        @element_stack = [] #: Array[String]
        @erb_block_stack = [] #: Array[Herb::AST::ERBBlockNode]
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

      private

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
          create_debug_attribute("data-herb-debug-file-relative-path", @relative_file_path || "unknown"),
          create_debug_attribute("data-herb-debug-file-full-path", @filename&.to_s || "unknown")
        ]

        if @top_level_elements.length > 1
          debug_attributes << create_debug_attribute("data-herb-debug-attach-to-parent", "true")
        end

        open_tag_node.children.concat(debug_attributes)

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
          create_debug_attribute("data-herb-debug-file-name", component_display_name),
          create_debug_attribute("data-herb-debug-file-relative-path", @relative_file_path || "unknown"),
          create_debug_attribute("data-herb-debug-file-full-path", @filename&.to_s || "unknown"),
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
                                       false, "Debug")
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
        return false unless @filename

        basename = @filename.basename.to_s
        basename.start_with?("_")
      end

      def component?
        return false unless @filename

        @filename.to_s.match?(%r{(^|/)app/components/})
      end

      def sidecar_component?
        return false unless component?
        return false unless @filename

        @filename.basename.to_s.match?(/\Acomponent\.(html\.erb|html\.herb|erb|herb)\z/)
      end

      def component_display_name
        return @filename&.basename&.to_s || "unknown" unless @filename

        basename = @filename.basename.to_s
        path = @filename.to_s

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
        excluded_tags = ["script", "style", "head", "textarea", "pre", "svg", "math"]
        return true if excluded_tags.any? { |tag| @element_stack.include?(tag) }

        return true if @erb_block_stack.any? { |node| javascript_tag?(node.content.value.strip) }

        false
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

      # TODO: Rewrite using Prism Nodes once available
      def javascript_tag?(code)
        cleaned_code = code.strip.gsub(/\s+/, " ")

        return true if cleaned_code.match?(/\bjavascript_tag\s.*do\s*$/) ||
                       cleaned_code.match?(/\bjavascript_tag\s.*\{\s*$/) ||
                       cleaned_code.match?(/\bjavascript_tag\(.*do\s*$/) ||
                       cleaned_code.match?(/\bjavascript_tag\(.*\{\s*$/)

        false
      end
    end
  end
end
