# frozen_string_literal: false

module Herb
  class Engine
    module Debug
      private

      def debug?
        @engine.debug
      end

      def process_debuggable_expression(node, opening, code, should_escape)
        erb_code = "#{opening} #{code} %>"
        add_debug_expr_start(erb_code, "[PLACEHOLDER]", node)
        add_expression_with_escaping(code, should_escape)
        add_debug_expr_end
      end

      def add_debug_expr_start(erb_code, output_content, node)
        return unless debug?

        line = node.respond_to?(:location) && node.location&.start&.line
        column = node.respond_to?(:location) && node.location&.start&.column

        escaped_erb = erb_code.gsub('&', '&amp;').gsub('<', '&lt;').gsub('>', '&gt;').gsub('"', '&quot;').gsub("'", '&#39;')

        debug_span = %{<span data-herb-debug-outline-type="erb-output" }
        debug_span += %{data-herb-debug-erb="#{escaped_erb}" }
        debug_span += %{data-herb-debug-file-name="#{@engine.filename.basename}" } if @engine.filename
        debug_span += %{data-herb-debug-file-relative-path="#{@engine.relative_file_path}" } if @engine.relative_file_path
        debug_span += %{data-herb-debug-file-full-path="#{@engine.filename}" } if @engine.filename
        debug_span += %{data-herb-debug-line="#{line}" } if line
        debug_span += %{data-herb-debug-column="#{column + 1}" } if column
        debug_span += %{style="display: contents;">}

        @tokens << [:debug_expr_start, debug_span, current_context]
      end

      def add_debug_expr_end
        return unless debug?

        @tokens << [:debug_expr_end, "</span>", current_context]
      end

      def should_debug_expression?(node)
        return false unless debug?

        return false unless current_context == :html_content

        return false if [:attribute_value, :script_content, :style_content].include?(current_context)
        return false if in_head_context?

        code = node.content.value.strip
        return false if is_complex_rails_helper?(code)

        true
      end

      def find_top_level_elements(document_node)
        @top_level_elements = []

        document_node.children.each do |child|
          if child.is_a?(Herb::AST::HTMLElementNode)
            @top_level_elements << child
          end
        end
      end

      def should_add_debug_attributes_to_element?(open_tag_node)
        return false if @debug_attributes_applied

        parent_element = find_parent_element_for_open_tag(open_tag_node)
        return false unless parent_element

        if @top_level_elements.length == 1
          return @top_level_elements.first == parent_element
        elsif @top_level_elements.length > 1
          return @top_level_elements.first == parent_element
        end

        false
      end

      def find_parent_element_for_open_tag(open_tag_node)
        @top_level_elements.find { |element|
          element.open_tag == open_tag_node
        }
      end

      def add_debug_attributes_to_element(open_tag_node)
        return if @debug_attributes_applied

        view_type = determine_view_type

        add_text(%{ data-herb-debug-outline-type="#{view_type}"})
        add_text(%{ data-herb-debug-file-name="#{@engine.filename&.basename || 'unknown'}"})
        add_text(%{ data-herb-debug-file-relative-path="#{@engine.relative_file_path}"})
        add_text(%{ data-herb-debug-file-full-path="#{@engine.filename || 'unknown'}"})

        if @top_level_elements.length > 1
          add_text(%{ data-herb-debug-attach-to-parent="true"})
        end

        @debug_attributes_applied = true
      end

      def determine_view_type
        if is_component?
          "component"
        elsif is_partial?
          "partial"
        else
          "view"
        end
      end

      def is_partial?
        return false unless @engine.filename

        basename = @engine.filename.basename.to_s
        basename.start_with?('_')
      end

      def is_component?
        return false unless @engine.filename

        path = @engine.filename.to_s
        path.include?('/components/')
      end

      def in_head_context?
        @element_stack.include?('head')
      end

      # TODO: convert this to analyze the Prism nodes once available
      def is_complex_rails_helper?(code)
        cleaned_code = code.strip.gsub(/\s+/, ' ')

        return true if cleaned_code.match?(/\bturbo_frame_tag\s*[\(\s]/)
        return true if cleaned_code.match?(/\blink_to\s.*\s+do\s*$/) || cleaned_code.match?(/\blink_to\s.*\{\s*$/) || cleaned_code.match?(/\blink_to\s.*\s+do\s*\|/) || cleaned_code.match?(/\blink_to\s.*\{\s*\|/)
        return true if cleaned_code.match?(/\brender[\s\(]/)
        return true if cleaned_code.match?(/\bform_with\s.*\s+do\s*[\|\$]/) || cleaned_code.match?(/\bform_with\s.*\{\s*[\|\$]/)
        return true if cleaned_code.match?(/\bcontent_for\s.*\s+do\s*$/) || cleaned_code.match?(/\bcontent_for\s.*\{\s*$/)
        return true if cleaned_code.match?(/\bcontent_tag\s.*\s+do\s*$/) || cleaned_code.match?(/\bcontent_tag\s.*\{\s*$/)
        return true if cleaned_code.match?(/\bcontent_tag\(.*\s+do\s*$/) || cleaned_code.match?(/\bcontent_tag\(.*\{\s*$/)
        return true if cleaned_code.match?(/\btag\.\w+\s.*do\s*$/) || cleaned_code.match?(/\btag\.\w+\s.*\{\s*$/)

        false
      end
    end
  end
end
