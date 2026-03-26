# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    class DebugVisitor < Herb::Rewriter
      def self.transformer_name
        "debug"
      end

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
        @in_html_doctype = false
      end

      def visit_document_node(node)
        find_top_level_elements(node)
        super
      end

      def visit_html_element_node(node)
        tag_name = node.tag_name&.value&.downcase
        @element_stack.push(tag_name) if tag_name

        add_debug_attributes_to_element(node) if should_add_debug_attributes?(node)

        super

        @element_stack.pop if tag_name
      end

      def visit_html_doctype_node(node)
        @in_html_doctype = true
        super
        @in_html_doctype = false
      end

      def visit_erb_content_node(node)
        if !@in_attribute && !@in_html_comment && !@in_html_doctype && !in_excluded_context? && erb_output?(node.tag_opening.value)
          code = node.content.value.strip

          unless complex_rails_helper?(code)
            debug_span = create_debug_span_for_erb(node)
            @replacements[node] = debug_span
          end
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

      def find_top_level_elements(document_node)
        document_node.children.each do |child|
          @top_level_elements << child if child.is_a?(Herb::AST::HTMLElementNode)
        end
      end

      def should_add_debug_attributes?(element_node)
        return false if @debug_attributes_applied
        return false if @top_level_elements.empty?

        @top_level_elements.first == element_node
      end

      def add_debug_attributes_to_element(element_node)
        return if @debug_attributes_applied

        view_type = determine_view_type

        add_attribute(element_node, "data-herb-debug-outline-type", view_type)
        add_attribute(element_node, "data-herb-debug-file-name", component_display_name)
        add_attribute(element_node, "data-herb-debug-file-relative-path", @relative_file_path || "unknown")
        add_attribute(element_node, "data-herb-debug-file-full-path", @filename&.to_s || "unknown")

        if @top_level_elements.length > 1
          add_attribute(element_node, "data-herb-debug-attach-to-parent", "true")
        end

        @debug_attributes_applied = true
      end

      def create_debug_span_for_erb(erb_node)
        opening = erb_node.tag_opening.value
        code = erb_node.content.value.strip
        erb_code = "#{opening} #{code} %>"

        return erb_node if complex_rails_helper?(code)

        line = erb_node.location&.start&.line
        column = erb_node.location&.start&.column
        escaped_erb = ::Herb::Engine.h(erb_code)

        outline_type = @top_level_elements.empty? ? "erb-output #{determine_view_type}" : "erb-output"

        attributes = [
          build_attribute("data-herb-debug-outline-type", outline_type),
          build_attribute("data-herb-debug-erb", escaped_erb),
          build_attribute("data-herb-debug-file-name", component_display_name),
          build_attribute("data-herb-debug-file-relative-path", @relative_file_path || "unknown"),
          build_attribute("data-herb-debug-file-full-path", @filename&.to_s || "unknown"),
          build_attribute("data-herb-debug-inserted", "true")
        ]

        attributes << build_attribute("data-herb-debug-line", line.to_s) if line
        attributes << build_attribute("data-herb-debug-column", (column + 1).to_s) if column
        attributes << build_attribute("style", "display: contents;")

        build_element(
          tag_name: "span",
          attributes: attributes,
          body: [erb_node],
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
        return false unless @filename

        @filename.basename.to_s.start_with?("_")
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

        if @erb_block_stack.any? { |node| javascript_tag?(node.content.value.strip) || include_debug_disable_comment?(node.content.value.strip) }
          return true
        end

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

      def include_debug_disable_comment?(code)
        cleaned_code = code.strip.gsub(/\s+/, " ")

        return true if cleaned_code.match?(/#\s*herb:debug\sdisable\s*$/)

        false
      end
    end
  end
end
