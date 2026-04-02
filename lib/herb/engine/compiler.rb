# frozen_string_literal: false

module Herb
  class Engine
    class Compiler < ::Herb::Visitor
      EXPRESSION_TOKEN_TYPES = [:expr, :expr_escaped, :expr_block, :expr_block_escaped].freeze

      TRAILING_WHITESPACE = /[ \t]+\z/
      TRAILING_INDENTATION = /\n[ \t]+\z/
      TRAILING_INDENTATION_CAPTURE = /\n([ \t]+)\z/
      WHITESPACE_ONLY = /\A[ \t]+\z/
      WHITESPACE_ONLY_CAPTURE = /\A([ \t]+)\z/

      attr_reader :tokens

      def initialize(engine, options = {})
        super()

        @engine = engine
        @escape = options.fetch(:escape) { options.fetch(:escape_html, false) }
        @tokens = [] #: Array[untyped]
        @element_stack = [] #: Array[String]
        @context_stack = [:html_content]
        @trim_next_whitespace = false
        @last_trim_consumed_newline = false
        @pending_leading_whitespace = nil
        @pending_leading_whitespace_insert_index = 0
      end

      def generate_output
        optimized_tokens = optimize_tokens(@tokens)

        optimized_tokens.each do |type, value, context, escaped|
          case type
          when :text
            @engine.send(:add_text, value)
          when :code
            @engine.send(:add_code, value)
          when :expr, :expr_escaped
            indicator = indicator_for(type)

            if context_aware_context?(context)
              @engine.send(:add_context_aware_expression, indicator, value, context)
            else
              @engine.send(:add_expression, indicator, value)
            end
          when :expr_block, :expr_block_escaped
            @engine.send(:add_expression_block, indicator_for(type), value)
          when :expr_block_end
            @engine.send(:add_expression_block_end, value, escaped: escaped)
          end
        end
      end

      def visit_document_node(node)
        visit_all(node.children)
      end

      def visit_html_element_node(node)
        with_element_context(node) do
          visit(node.open_tag)
          visit_all(node.body)

          tag_name = node.tag_name&.value&.downcase

          if node.open_tag.is_a?(Herb::AST::ERBOpenTagNode) && tag_name && node.close_tag
            add_text("</#{tag_name}>")
          else
            visit(node.close_tag)
          end
        end
      end

      def visit_html_conditional_element_node(node)
        with_element_context(node) do
          visit(node.open_conditional)
          visit_all(node.body)
          visit(node.close_conditional)
        end
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

        has_equals = node.equals.value&.include?("=")
        add_text(has_equals ? node.equals.value : "=")

        visit(node.value)
      end

      def visit_html_attribute_name_node(node)
        visit_all(node.children)
      end

      def visit_html_attribute_value_node(node)
        push_context(:attribute_value)

        add_text(node.open_quote&.value || '"') if node.quoted
        visit_all(node.children)
        add_text(node.close_quote&.value || '"') if node.quoted

        pop_context
      end

      def visit_erb_open_tag_node(node)
        tag_name = node.tag_name&.value

        if tag_name
          is_void = Herb::HTML::Util.void_element?(tag_name)
          uses_self_closing = is_void && @current_element_source != "ActionView::Helpers::TagHelper#tag"

          add_text("<")
          add_text(tag_name)

          node.children.each do |child|
            visit(child)
          end

          add_text(uses_self_closing ? " />" : ">")
        else
          process_erb_tag(node)
        end
      end

      def visit_html_virtual_close_tag_node(node)
        tag_name = node.tag_name&.value

        return unless tag_name

        add_text("</")
        add_text(tag_name)
        add_text(">")
      end

      def visit_ruby_literal_node(node)
        add_expression(node.content)
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
        add_text(node.tag_opening.value)
        visit_all(node.children)
        add_text(node.tag_closing.value)
      end

      def visit_erb_content_node(node)
        return if inline_ruby_comment?(node)

        process_erb_tag(node)
      end

      def visit_erb_control_node(node, &_block)
        if node.content
          apply_trim(node, node.content.value.strip)
        end

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

        check_for_escaped_erb_tag!(opening)

        if opening.include?("=")
          should_escape = should_escape_output?(opening)
          code = node.content.value.strip

          @tokens << if should_escape
                       [:expr_block_escaped, code, current_context]
                     else
                       [:expr_block, code, current_context]
                     end

          @last_trim_consumed_newline = false
          @trim_next_whitespace = true if right_trim?(node)

          visit_all(node.body)
          visit_erb_block_end_node(node.end_node, escaped: should_escape)
        else
          visit_erb_control_node(node) do
            visit_all(node.body)
            visit(node.rescue_clause)
            visit(node.else_clause)
            visit(node.ensure_clause)
            visit(node.end_node)
          end
        end
      end

      def visit_erb_block_end_node(node, escaped: false)
        remove_trailing_whitespace_from_last_token! if left_trim?(node)

        code = node.content.value.strip

        if at_line_start?
          leading_space = extract_and_remove_leading_space!
          right_space = " \n"

          @tokens << [:expr_block_end, "#{leading_space}#{code}#{right_space}", current_context, escaped]
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

      def check_for_escaped_erb_tag!(opening)
        return unless opening.start_with?("<%%")

        raise Herb::Engine::GeneratorTemplateError,
              "This file appears to be a generator template (a template used to generate ERB files) " \
              "rather than a standard ERB template. It contains escaped ERB tags like <%%= %> which " \
              "produce literal ERB output in the generated file."
      end

      def current_context
        @context_stack.last
      end

      def push_context(context)
        @context_stack.push(context)
      end

      def pop_context
        @context_stack.pop
      end

      #: (untyped node) { () -> untyped } -> untyped
      def with_element_context(node)
        tag_name = node.tag_name&.value&.downcase
        previous_element_source = @current_element_source
        @current_element_source = node.element_source

        @element_stack.push(tag_name) if tag_name

        if tag_name == "script"
          push_context(:script_content)
        elsif tag_name == "style"
          push_context(:style_content)
        end

        yield

        pop_context if ["script", "style"].include?(tag_name)

        @element_stack.pop if tag_name
        @current_element_source = previous_element_source
      end

      def process_erb_tag(node, skip_comment_check: false)
        opening = node.tag_opening.value

        check_for_escaped_erb_tag!(opening)

        if !skip_comment_check && erb_comment?(opening)
          follows_newline = leading_space_follows_newline?
          remove_trailing_whitespace_from_last_token! if left_trim?(node)

          if at_line_start?
            leading_space = extract_and_remove_leading_space!
            @trim_next_whitespace = true
            save_pending_leading_whitespace!(leading_space) if !leading_space.empty? && follows_newline
          end
          return
        end
        return if erb_graphql?(opening)

        code = node.content.value.strip

        if erb_output?(opening)
          process_erb_output(node, opening, code)
        else
          apply_trim(node, code)
        end
      end

      def add_text(text)
        return if text.empty?

        if @trim_next_whitespace
          @last_trim_consumed_newline = text.match?(/\A[ \t]*\r?\n/)
          text = text.sub(/\A[ \t]*\r?\n/, "")
          @trim_next_whitespace = false

          restore_pending_leading_whitespace! unless @last_trim_consumed_newline
        else
          @last_trim_consumed_newline = false
        end

        @pending_leading_whitespace = nil

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
        @last_trim_consumed_newline = false
      end

      def add_expression_escaped(code)
        @tokens << [:expr_escaped, code, current_context]
        @last_trim_consumed_newline = false
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

      def process_erb_output(node, opening, code)
        if @trim_next_whitespace && @pending_leading_whitespace
          restore_pending_leading_whitespace!
          @pending_leading_whitespace = nil
          @trim_next_whitespace = false
          @last_trim_consumed_newline = false
        end

        should_escape = should_escape_output?(opening)
        add_expression_with_escaping(code, should_escape)
        @trim_next_whitespace = true if right_trim?(node)
      end

      def indicator_for(type)
        escaped = [:expr_escaped, :expr_block_escaped].include?(type)

        escaped ^ @escape ? "==" : "="
      end

      def context_aware_context?(context)
        [:attribute_value, :script_content, :style_content].include?(context)
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
        return true if @tokens.empty?

        last_type = @tokens.last[0]
        last_value = @tokens.last[1]

        if last_type == :text
          last_value.empty? || last_value.end_with?("\n") || (last_value =~ WHITESPACE_ONLY && preceding_token_ends_with_newline?) || last_value =~ TRAILING_INDENTATION
        elsif EXPRESSION_TOKEN_TYPES.include?(last_type)
          @last_trim_consumed_newline
        else
          last_value.end_with?("\n")
        end
      end

      def preceding_token_ends_with_newline?
        return true unless @tokens.length >= 2

        preceding = @tokens[-2]
        return @last_trim_consumed_newline if EXPRESSION_TOKEN_TYPES.include?(preceding[0])
        return preceding[1].end_with?("\n") if preceding[0] == :expr_block_end
        return true unless preceding[0] == :text

        preceding[1].end_with?("\n")
      end

      def left_trim?(node)
        node.tag_opening.value == "<%-"
      end

      def right_trim?(node)
        node.tag_closing&.value == "-%>"
      end

      def last_text_token
        return unless @tokens.last && @tokens.last[0] == :text

        @tokens.last
      end

      def extract_leading_space
        token = last_text_token
        return "" unless token

        text = token[1]

        return Regexp.last_match(1) if text =~ TRAILING_INDENTATION_CAPTURE || text =~ WHITESPACE_ONLY_CAPTURE

        ""
      end

      def leading_space_follows_newline?
        token = last_text_token
        return false unless token

        text = token[1]

        return true if text.match?(TRAILING_INDENTATION)
        return true if @last_trim_consumed_newline && text.match?(WHITESPACE_ONLY)

        false
      end

      def extract_and_remove_leading_space!
        leading_space = extract_leading_space
        return leading_space if leading_space.empty?

        text = @tokens.last[1]

        if text =~ TRAILING_INDENTATION
          text.sub!(TRAILING_WHITESPACE, "")
        elsif text =~ WHITESPACE_ONLY
          text.replace("")
        end

        @tokens.last[1] = text

        leading_space
      end

      def apply_trim(node, code)
        follows_newline = leading_space_follows_newline?
        removed_whitespace = left_trim?(node) ? remove_trailing_whitespace_from_last_token! : ""

        if at_line_start?
          leading_space = extract_and_remove_leading_space!
          effective_leading_space = leading_space.empty? ? removed_whitespace : leading_space
          right_space = Herb::Engine.heredoc?(code) ? "\n" : " \n"

          @pending_leading_whitespace_insert_index = @tokens.length
          @pending_leading_whitespace = effective_leading_space if !effective_leading_space.empty? && follows_newline
          @tokens << [:code, "#{effective_leading_space}#{code}#{right_space}", current_context]
          @trim_next_whitespace = true
        else
          @tokens << [:code, code, current_context]
        end
      end

      def save_pending_leading_whitespace!(whitespace)
        @pending_leading_whitespace = whitespace
        @pending_leading_whitespace_insert_index = @tokens.length
      end

      def restore_pending_leading_whitespace!
        return unless @pending_leading_whitespace

        @tokens.insert(@pending_leading_whitespace_insert_index, [:text, @pending_leading_whitespace, current_context])
      end

      def remove_trailing_whitespace_from_last_token!
        token = last_text_token
        return "" unless token

        text = token[1]
        removed = text[TRAILING_WHITESPACE] || ""

        if text =~ TRAILING_INDENTATION
          text.sub!(TRAILING_WHITESPACE, "")
          token[1] = text
        elsif text =~ WHITESPACE_ONLY
          text.replace("")
          token[1] = text
        end

        removed
      end
    end
  end
end
