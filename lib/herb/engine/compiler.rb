# frozen_string_literal: false

module Herb
  class Engine
    class Compiler < ::Herb::Visitor
      attr_reader :tokens

      def initialize(engine, options = {})
        super()

        @engine = engine
        @escape = options.fetch(:escape) { options.fetch(:escape_html, false) }
        @attrfunc = options.fetch(:attrfunc, @escape ? "__herb.attr" : "::Herb::Engine.attr")
        @jsfunc = options.fetch(:jsfunc, @escape ? "__herb.js" : "::Herb::Engine.js")
        @cssfunc = options.fetch(:cssfunc, @escape ? "__herb.css" : "::Herb::Engine.css")
        @tokens = [] #: Array[untyped]
        @element_stack = [] #: Array[String]
        @context_stack = [:html_content]
        @trim_next_whitespace = false
      end

      def generate_output
        optimized_tokens = optimize_tokens(@tokens)

        optimized_tokens.each do |type, value, context, escaped|
          case type
          when :text
            @engine.send(:add_text, value)
          when :code
            @engine.send(:add_code, value)
          when :expr
            if [:attribute_value, :script_content, :style_content].include?(context)
              add_context_aware_expression(value, context)
            else
              indicator = @escape ? "==" : "="
              @engine.send(:add_expression, indicator, value)
            end
          when :expr_escaped
            if [:attribute_value, :script_content, :style_content].include?(context)
              add_context_aware_expression(value, context)
            else
              indicator = @escape ? "=" : "=="
              @engine.send(:add_expression, indicator, value)
            end
          when :expr_block
            indicator = @escape ? "==" : "="
            @engine.send(:add_expression_block, indicator, value)
          when :expr_block_escaped
            indicator = @escape ? "=" : "=="
            @engine.send(:add_expression_block, indicator, value)
          when :expr_block_end
            @engine.send(:add_expression_block_end, value, escaped: escaped)
          end
        end
      end

      def visit_document_node(node)
        visit_all(node.children)
      end

      def visit_html_element_node(node)
        tag_name = node.tag_name&.value&.downcase

        @element_stack.push(tag_name) if tag_name

        if tag_name == "script"
          push_context(:script_content)
        elsif tag_name == "style"
          push_context(:style_content)
        end

        visit(node.open_tag)
        visit_all(node.body)
        visit(node.close_tag)

        pop_context if ["script", "style"].include?(tag_name)

        @element_stack.pop if tag_name
      end

      def visit_html_conditional_element_node(node)
        tag_name = node.tag_name&.value&.downcase

        @element_stack.push(tag_name) if tag_name

        if tag_name == "script"
          push_context(:script_content)
        elsif tag_name == "style"
          push_context(:style_content)
        end

        visit(node.open_conditional)
        visit_all(node.body)
        visit(node.close_conditional)

        pop_context if ["script", "style"].include?(tag_name)

        @element_stack.pop if tag_name
      end

      def visit_html_open_tag_node(node)
        add_text(node.tag_opening&.value || "<")
        add_text(node.tag_name.value) if node.tag_name

        visit_all(node.children)

        add_text(node.tag_closing&.value || ">")
      end

      def visit_html_attribute_node(node)
        add_whitespace(" ")

        visit(node.name)

        return unless node.value

        add_text(node.equals.value)
        visit(node.value)
      end

      def visit_html_attribute_name_node(node)
        visit_all(node.children)
      end

      def visit_html_attribute_value_node(node)
        push_context(:attribute_value)

        add_text(node.open_quote&.value) if node.quoted

        visit_all(node.children)

        add_text(node.close_quote&.value) if node.quoted

        pop_context
      end

      def visit_html_close_tag_node(node)
        tag_name = node.tag_name&.value&.downcase

        if @engine.content_for_head && tag_name == "head"
          escaped_html = @engine.content_for_head.gsub("'", "\\\\'")
          @tokens << [:expr, "'#{escaped_html}'.html_safe", current_context]
        end

        add_text(node.tag_opening&.value)
        add_text(node.tag_name&.value)
        add_text(node.tag_closing&.value)
      end

      def visit_html_omitted_close_tag_node(node)
        # no-op
      end

      def visit_html_text_node(node)
        add_text(node.content)
      end

      def visit_literal_node(node)
        add_text(node.content)
      end

      def visit_whitespace_node(node)
        add_whitespace(node.value.value)
      end

      def visit_html_comment_node(node)
        add_text(node.comment_start.value)
        visit_all(node.children)
        add_text(node.comment_end.value)
      end

      def visit_html_doctype_node(node)
        add_text(node.tag_opening.value)
        visit_all(node.children)
        add_text(node.tag_closing.value)
      end

      def visit_xml_declaration_node(node)
        add_text(node.tag_opening.value)
        visit_all(node.children)
        add_text(node.tag_closing.value)
      end

      def visit_cdata_node(node)
        add_text(node.cdata_opening.value)
        visit_all(node.children)
        add_text(node.cdata_closing.value)
      end

      def visit_erb_content_node(node)
        return if inline_ruby_comment?(node)

        process_erb_tag(node)
      end

      def visit_erb_control_node(node, &_block)
        apply_trim(node, node.content.value.strip)

        yield if block_given?
      end

      def visit_erb_if_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.subsequent)
          visit(node.end_node)
        end
      end

      def visit_erb_else_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
        end
      end

      def visit_erb_unless_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.else_clause)
          visit(node.end_node)
        end
      end

      def visit_erb_case_node(node)
        visit_erb_control_with_parts(node, :conditions, :else_clause, :end_node)
      end

      def visit_erb_when_node(node)
        visit_erb_control_with_parts(node, :statements)
      end

      def visit_erb_for_node(node)
        visit_erb_control_with_parts(node, :statements, :end_node)
      end

      def visit_erb_while_node(node)
        visit_erb_control_with_parts(node, :statements, :end_node)
      end

      def visit_erb_until_node(node)
        visit_erb_control_with_parts(node, :statements, :end_node)
      end

      def visit_erb_begin_node(node)
        visit_erb_control_with_parts(node, :statements, :rescue_clause, :else_clause, :ensure_clause, :end_node)
      end

      def visit_erb_rescue_node(node)
        visit_erb_control_with_parts(node, :statements, :subsequent)
      end

      def visit_erb_ensure_node(node)
        visit_erb_control_with_parts(node, :statements)
      end

      def visit_erb_end_node(node)
        visit_erb_control_node(node)
      end

      def visit_erb_case_match_node(node)
        visit_erb_control_with_parts(node, :conditions, :else_clause, :end_node)
      end

      def visit_erb_in_node(node)
        visit_erb_control_with_parts(node, :statements)
      end

      def visit_erb_yield_node(node)
        process_erb_tag(node, skip_comment_check: true)
      end

      def visit_erb_block_node(node)
        opening = node.tag_opening.value

        if opening.include?("=")
          should_escape = should_escape_output?(opening)
          code = node.content.value.strip

          @tokens << if should_escape
                       [:expr_block_escaped, code, current_context]
                     else
                       [:expr_block, code, current_context]
                     end

          visit_all(node.body)
          visit_erb_block_end_node(node.end_node, escaped: should_escape)
        else
          visit_erb_control_node(node) do
            visit_all(node.body)
            visit(node.end_node)
          end
        end
      end

      def visit_erb_block_end_node(node, escaped: false)
        has_left_trim = node.tag_opening.value.start_with?("<%-")

        remove_trailing_whitespace_from_last_token! if has_left_trim

        code = node.content.value.strip

        if at_line_start?
          lspace = extract_and_remove_lspace!
          rspace = " \n"

          @tokens << [:expr_block_end, "#{lspace}#{code}#{rspace}", current_context, escaped]
          @trim_next_whitespace = true
        else
          @tokens << [:expr_block_end, code, current_context, escaped]
        end
      end

      def visit_erb_control_with_parts(node, *parts)
        visit_erb_control_node(node) do
          parts.each do |part|
            value = node.send(part)
            case value
            when Array
              visit_all(value)
            when nil
              # Skip nil values
            else
              visit(value)
            end
          end
        end
      end

      private

      def current_context
        @context_stack.last
      end

      def push_context(context)
        @context_stack.push(context)
      end

      def pop_context
        @context_stack.pop
      end

      def add_context_aware_expression(code, context)
        closing = code.include?("#") ? "\n))" : "))"

        case context
        when :attribute_value
          @engine.send(:with_buffer) {
            @engine.src << " << #{@attrfunc}((" << code << closing
          }
        when :script_content
          @engine.send(:with_buffer) {
            @engine.src << " << #{@jsfunc}((" << code << closing
          }
        when :style_content
          @engine.send(:with_buffer) {
            @engine.src << " << #{@cssfunc}((" << code << closing
          }
        else
          @engine.send(:add_expression_result_escaped, code)
        end
      end

      def process_erb_tag(node, skip_comment_check: false)
        opening = node.tag_opening.value

        return if !skip_comment_check && erb_comment?(opening)
        return if erb_graphql?(opening)

        code = node.content.value.strip

        if erb_output?(opening)
          process_erb_output(opening, code)
        else
          apply_trim(node, code)
        end
      end

      def add_text(text)
        return if text.empty?

        if @trim_next_whitespace
          text = text.sub(/\A[ \t]*\r?\n/, "")
          @trim_next_whitespace = false
        end

        return if text.empty?

        @tokens << [:text, text, current_context]
      end

      def add_whitespace(whitespace)
        @tokens << [:whitespace, whitespace, current_context]
      end

      def add_code(code)
        @tokens << [:code, code, current_context]
      end

      def add_expression(code)
        @tokens << [:expr, code, current_context]
      end

      def add_expression_escaped(code)
        @tokens << [:expr_escaped, code, current_context]
      end

      def optimize_tokens(tokens)
        return tokens if tokens.empty?

        compacted = compact_whitespace_tokens(tokens)

        optimized = [] #: Array[untyped]
        current_text = ""
        current_context = nil

        compacted.each do |type, value, context, escaped|
          if type == :text
            current_text += value
            current_context ||= context
          else
            unless current_text.empty?
              optimized << [:text, current_text, current_context]

              current_text = ""
              current_context = nil
            end

            optimized << [type, value, context, escaped]
          end
        end

        optimized << [:text, current_text, current_context] unless current_text.empty?

        optimized
      end

      def compact_whitespace_tokens(tokens)
        return tokens if tokens.empty?

        tokens.map.with_index { |token, index|
          next token unless token[0] == :whitespace

          next nil if adjacent_whitespace?(tokens, index)
          next nil if whitespace_before_code_sequence?(tokens, index)

          [:text, token[1], token[2]]
        }.compact
      end

      def adjacent_whitespace?(tokens, index)
        prev_token = index.positive? ? tokens[index - 1] : nil
        next_token = index < tokens.length - 1 ? tokens[index + 1] : nil

        trailing_whitespace?(prev_token) || leading_whitespace?(next_token)
      end

      def trailing_whitespace?(token)
        return false unless token

        token[0] == :whitespace || (token[0] == :text && token[1] =~ /\s\z/)
      end

      def leading_whitespace?(token)
        token && token[0] == :text && token[1] =~ /\A\s/
      end

      def whitespace_before_code_sequence?(tokens, current_index)
        previous_token = tokens[current_index - 1] if current_index.positive?

        return false unless previous_token && previous_token[0] == :code

        token_before_code = find_token_before_code_sequence(tokens, current_index)

        return false unless token_before_code

        trailing_whitespace?(token_before_code)
      end

      def find_token_before_code_sequence(tokens, whitespace_index)
        search_index = whitespace_index - 1

        search_index -= 1 while search_index >= 0 && tokens[search_index][0] == :code

        search_index >= 0 ? tokens[search_index] : nil
      end

      def process_erb_output(opening, code)
        should_escape = should_escape_output?(opening)
        add_expression_with_escaping(code, should_escape)
      end

      def should_escape_output?(opening)
        is_double_equals = opening == "<%=="
        is_double_equals ? !@escape : @escape
      end

      def add_expression_with_escaping(code, should_escape)
        if should_escape
          add_expression_escaped(code)
        else
          add_expression(code)
        end
      end

      def at_line_start?
        @tokens.empty? ||
          @tokens.last[0] != :text ||
          @tokens.last[1].empty? ||
          @tokens.last[1].end_with?("\n") ||
          @tokens.last[1] =~ /\A[ \t]+\z/ ||
          @tokens.last[1] =~ /\n[ \t]+\z/
      end

      def extract_lspace
        return "" unless @tokens.last && @tokens.last[0] == :text

        text = @tokens.last[1]

        return Regexp.last_match(1) if text =~ /\n([ \t]+)\z/ || text =~ /\A([ \t]+)\z/

        ""
      end

      def extract_and_remove_lspace!
        lspace = extract_lspace
        return lspace if lspace.empty?

        text = @tokens.last[1]
        if text =~ /\n[ \t]+\z/
          text.sub!(/[ \t]+\z/, "")
        elsif text =~ /\A[ \t]+\z/
          text.replace("")
        end
        @tokens.last[1] = text

        lspace
      end

      def apply_trim(node, code)
        has_left_trim = node.tag_opening.value.start_with?("<%-")
        node.tag_closing&.value

        remove_trailing_whitespace_from_last_token! if has_left_trim

        if at_line_start?
          lspace = extract_and_remove_lspace!
          rspace = Herb::Engine.heredoc?(code) ? "\n" : " \n"

          @tokens << [:code, "#{lspace}#{code}#{rspace}", current_context]
          @trim_next_whitespace = true
        else
          @tokens << [:code, code, current_context]
        end
      end

      def remove_trailing_whitespace_from_last_token!
        return unless @tokens.last && @tokens.last[0] == :text

        text = @tokens.last[1]

        if text =~ /\n[ \t]+\z/
          text.sub!(/[ \t]+\z/, "")
          @tokens.last[1] = text
        elsif text =~ /\A[ \t]+\z/
          text.replace("")
          @tokens.last[1] = text
        end
      end
    end
  end
end
