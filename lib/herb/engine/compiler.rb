# frozen_string_literal: false

require_relative "../html/util"

module Herb
  class Engine
    class Compiler < ::Herb::Visitor
      EXPRESSION_TOKEN_TYPES = [:expr, :expr_escaped, :expr_block, :expr_block_escaped].freeze

      TRAILING_WHITESPACE = /[ \t]+\z/
      TRAILING_INDENTATION = /\n[ \t]+\z/
      TRAILING_INDENTATION_CAPTURE = /\n([ \t]+)\z/
      WHITESPACE_ONLY = /\A[ \t]+\z/
      WHITESPACE_ONLY_CAPTURE = /\A([ \t]+)\z/

      RAW_TEXT_ELEMENTS = ["script", "style"].freeze

      attr_reader :tokens

      def initialize(engine, options = {})
        super()

        @engine = engine
        @escape = options.fetch(:escape) { options.fetch(:escape_html, false) }
        @tokens = [] #: Array[untyped]
        @padding_before = Hash.new(0) #: Hash[Integer, Integer]
        @element_stack = [] #: Array[String]
        @context_stack = [:html_content]
        @trim_next_whitespace = false
        @last_trim_consumed_newline = false
        @pending_leading_whitespace = nil
        @pending_leading_whitespace_insert_index = 0
        @current_element_source = nil
      end

      def optimized_tokens
        @optimized_tokens ||= optimize_tokens(@tokens)
      end

      def static_template_text
        return unless optimized_tokens.all? { |token| token[0] == :text }

        optimized_tokens.map { |token| token[1] }.join
      end

      def generate_output
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
        with_element_context(node) do |tag_name|
          visit(node.open_tag)
          visit_all(node.body)

          if node.open_tag.is_a?(Herb::AST::ERBOpenTagNode) && tag_name && node.close_tag
            if node.close_tag.is_a?(Herb::AST::ERBEndNode)
              remove_trailing_whitespace_from_last_token! if left_trim?(node.close_tag)
              add_text("</#{tag_name}>")
              @trim_next_whitespace = true
            else
              add_text("</#{tag_name}>")
            end
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
        add_text(" ") unless preceded_by_whitespace?

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
        add_text(node.value.value)
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

      def visit_xml_processing_instruction_node(node)
        add_text(node.tag_opening.value)
        add_text(node.target.value)
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

      def visit_erb_control_node(node, &)
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

      def visit_erb_iteration_block_node(node)
        visit_erb_block_node(node)
      end

      def visit_erb_render_node(node)
        return process_erb_tag(node) unless node.end_node

        visit_erb_block_node(node)
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

      #: (untyped node) { (String?) -> untyped } -> untyped
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

        yield(tag_name)

        pop_context if RAW_TEXT_ELEMENTS.include?(tag_name)

        @element_stack.pop if tag_name
        @current_element_source = previous_element_source
      end

      def process_erb_tag(node, skip_comment_check: false)
        opening = node.tag_opening.value

        check_for_escaped_erb_tag!(opening)

        if !skip_comment_check && erb_comment?(opening)
          follows_newline = leading_space_follows_newline?
          remove_trailing_whitespace_from_last_token! if left_trim?(node)
          swallows_newline = at_line_start?

          if swallows_newline
            leading_space = extract_and_remove_leading_space!
            @trim_next_whitespace = true
            save_pending_leading_whitespace!(leading_space) if !leading_space.empty? && follows_newline
          end

          keep_line_count(node, extra: swallows_newline ? 1 : 0)

          return
        end
        return if erb_graphql?(opening)

        code = node.content.value.strip

        if erb_output?(opening)
          process_erb_output(node, opening, code)
        else
          apply_trim(node, code)
        end

        keep_line_count(node)
      end

      def keep_line_count(node, extra: 0)
        lines = node.content.value.count("\n") - node.content.value.strip.count("\n") + extra

        @padding_before[@tokens.length] += lines if lines.positive?
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

        optimized = [] #: Array[untyped]
        current_text = nil #: String?
        current_context = nil

        pending_padding = 0

        flush = lambda do
          if current_text
            optimized << [:text, current_text, current_context]

            current_text = nil
            current_context = nil
          end

          if pending_padding.positive?
            optimized << [:code, "\n" * pending_padding, nil]
            pending_padding = 0
          end
        end

        tokens.each_with_index do |token, index|
          pending_padding += @padding_before[index]

          unless token[0] == :text
            flush.call
            optimized << [token[0], token[1], token[2], token[3]]

            next
          end

          if current_text
            current_text << token[1]
            current_context ||= token[2]
          else
            current_text = token[1].dup
            current_context = token[2]
          end
        end

        pending_padding += @padding_before[tokens.length]

        flush.call

        optimized
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
          last_value.empty? || last_value.end_with?("\n") || (last_value.match?(WHITESPACE_ONLY) && preceding_token_ends_with_newline?) || last_value.match?(TRAILING_INDENTATION)
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

      def preceded_by_whitespace?
        index = @tokens.length - 1
        index -= 1 while index >= 0 && emits_nothing?(@tokens[index])

        return false if index.negative?

        token = @tokens[index]

        return false unless token[0] == :text

        token[1].match?(/\s\z/)
      end

      def emits_nothing?(token)
        token[0] == :code || (token[0] == :text && token[1].empty?)
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

        text.match?(WHITESPACE_ONLY) && (preceding_text_ends_with_newline? || @last_trim_consumed_newline)
      end

      def preceding_text_ends_with_newline?
        return false unless @tokens.length >= 2

        preceding = @tokens[-2]

        preceding[0] == :text && preceding[1].end_with?("\n")
      end

      def extract_and_remove_leading_space!
        leading_space = extract_leading_space
        return leading_space if leading_space.empty?

        text = @tokens.last[1]

        if text.match?(TRAILING_INDENTATION)
          text.sub!(TRAILING_WHITESPACE, "")
        elsif text.match?(WHITESPACE_ONLY)
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

        if text.match?(TRAILING_INDENTATION)
          text.sub!(TRAILING_WHITESPACE, "")
          token[1] = text
        elsif text.match?(WHITESPACE_ONLY)
          text.replace("")
          token[1] = text
        end

        removed
      end
    end
  end
end
