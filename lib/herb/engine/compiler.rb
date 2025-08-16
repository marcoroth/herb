# frozen_string_literal: false

module Herb
  class Engine
    class Compiler < ::Herb::Visitor
      attr_reader :output, :tokens

      def initialize(options = {})
        @bufvar = options[:bufvar] || "_buf"
        @escape = options[:escape] || false
        @escapefunc = options[:escapefunc] || "::Herb::Engine.h"
        @freeze_template_literals = options.fetch(:freeze_template_literals, true)
        @tokens = []
        @context_stack = [:html_content]
        @text_end = @freeze_template_literals ? "'.freeze" : "'"
      end

      def output
        @output ||= generate_output_from_tokens
      end

      def visit_document_node(node)
        visit_all(node.children)
      end

      def visit_html_element_node(node)
        tag_name = node.tag_name&.value&.downcase

        if tag_name == 'script'
          push_context(:script_content)
        elsif tag_name == 'style'
          push_context(:style_content)
        end

        visit(node.open_tag)
        visit_all(node.body)
        visit(node.close_tag)

        if %w[script style].include?(tag_name)
          pop_context
        end
      end

      def visit_html_open_tag_node(node)
        validate_tag_security(node)

        add_text(node.tag_opening&.value || "<")
        add_text(node.tag_name.value) if node.tag_name

        visit_all(node.children)

        add_text(node.tag_closing&.value || ">")
      end

      def visit_html_attribute_node(node)
        add_text(" ")

        visit(node.name)

        return unless node.value

        add_text("=") # TODO: node.equals.value
        visit(node.value)
      end

      def visit_html_attribute_name_node(node)
        node.children.each do |child|
          if child.is_a?(Herb::AST::ERBContentNode) && erb_outputs?(child)
            raise_security_error(
              "ERB output in attribute names is not allowed for security reasons.",
              child,
              "Use static attribute names with dynamic values instead."
            )
          end
        end

        node.children.each do |child|
          add_text(extract_text_content(child))
        end
      end

      def visit_html_attribute_value_node(node)
        push_context(:attribute_value)

        if node.quoted
          quote = node.open_quote&.value || '"'
          add_text(quote)
        end

        visit_all(node.children)

        if node.quoted
          quote = node.close_quote&.value || '"'
          add_text(quote)
        end

        pop_context
      end

      def visit_html_close_tag_node(node)
        tag_text = ""
        tag_text += node.tag_opening&.value || "</"
        tag_text += node.tag_name.value if node.tag_name
        tag_text += node.tag_closing&.value || ">"

        add_text(tag_text) unless tag_text.empty?
      end

      def visit_html_text_node(node)
        add_text(node.content)
      end

      def visit_literal_node(node)
        add_text(node.content)
      end

      def visit_whitespace_node(node)
        add_text(node.value.value) if node.value
      end

      # TODO: add strip HTML comments option
      def visit_html_comment_node(node)
        has_erb = node.children.any? { |child| child.is_a?(Herb::AST::ERBContentNode) }

        if has_erb
          add_text(node.comment_start.value)
          node.children.each do |child|
            if child.is_a?(Herb::AST::ERBContentNode)
              visit(child)
            else
              text_content = extract_text_content(child)
              add_text(text_content) unless text_content.empty?
            end
          end
          add_text(node.comment_end.value)
        else
          comment_text = node.comment_start.value

          node.children.each do |child|
            comment_text << extract_text_content(child)
          end

          comment_text << node.comment_end.value

          add_text(comment_text)
        end
      end

      def visit_html_doctype_node(node)
        doctype_text = node.tag_opening.value

        node.children.each do |child|
          doctype_text << extract_text_content(child)
        end

        doctype_text << node.tag_closing.value

        add_text(doctype_text)
      end

      def visit_erb_content_node(node)
        process_erb_tag(node)
      end

      def visit_erb_control_node(node)
        add_code(node.content.value.strip)

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

      def visit_erb_block_node(node)
        visit_erb_control_node(node) do
          visit_all(node.body)
          visit(node.end_node)
        end
      end

      def visit_erb_case_node(node)
        visit_erb_control_node(node) do
          visit_all(node.conditions)
          visit(node.else_clause)
          visit(node.end_node)
        end
      end

      def visit_erb_when_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
        end
      end

      def visit_erb_for_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.end_node)
        end
      end

      def visit_erb_while_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.end_node)
        end
      end

      def visit_erb_until_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.end_node)
        end
      end

      def visit_erb_begin_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.rescue_clause)
          visit(node.else_clause)
          visit(node.ensure_clause)
          visit(node.end_node)
        end
      end

      def visit_erb_rescue_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
          visit(node.subsequent)
        end
      end

      def visit_erb_ensure_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
        end
      end

      def visit_erb_end_node(node)
        visit_erb_control_node(node)
      end

      def visit_erb_case_match_node(node)
        visit_erb_control_node(node) do
          visit_all(node.children) if node.children
          visit_all(node.conditions)
          visit(node.else_clause)
          visit(node.end_node)
        end
      end

      def visit_erb_in_node(node)
        visit_erb_control_node(node) do
          visit_all(node.statements)
        end
      end

      def visit_erb_yield_node(node)
        process_erb_tag(node, skip_comment_check: true)
      end

      def visit_xml_declaration_node(node)
        declaration_text = node.tag_opening.value

        node.children.each do |child|
          declaration_text << extract_text_content(child)
        end

        declaration_text << node.tag_closing.value

        add_text(declaration_text)
      end

      def visit_cdata_node(node)
        cdata_text = node.cdata_opening.value

        node.children.each do |child|
          cdata_text << extract_text_content(child)
        end

        cdata_text << node.cdata_closing.value

        add_text(cdata_text)
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

      def process_erb_tag(node, skip_comment_check: false)
        opening = node.tag_opening.value

        return if !skip_comment_check && opening.start_with?("<%#")

        code = node.content.value.strip

        if opening.include?("=")
          is_double_equals = opening == "<%=="
          should_escape = is_double_equals ? !@escape : @escape

          if should_escape
            add_expression_escaped(code)
          else
            add_expression(code)
          end
        else
          add_code(code)
        end

        if node.tag_closing&.value === "-%>"
          @trim_next_whitespace = true
        end
      end

      # Token-based output methods
      def add_text(text)
        return if text.empty?

        if @trim_next_whitespace
          text = text.lstrip
          @trim_next_whitespace = false
        end

        return if text.empty?

        @tokens << [:text, text, current_context]
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

      # Generate Ruby code from optimized tokens
      def generate_output_from_tokens
        optimized_tokens = optimize_tokens(@tokens)
        code = +""

        optimized_tokens.each do |type, value, context|
          case type
          when :text
            escaped = value.gsub(/['\\]/, '\\\\\&')
            code += " #{@bufvar} << '#{escaped}#{@text_end};"
          when :code
            code += " #{value};"
          when :expr
            code += generate_expression_code(value, context)
          when :expr_escaped
            code += " #{@bufvar} << #{@escapefunc}((#{value}));"
          end
        end

        code
      end

      # Context-aware expression code generation
      def generate_expression_code(code, context)
        case context
        when :attribute_value
          " #{@bufvar} << ::Herb::Engine.attr((#{code}));"
        when :script_content
          " #{@bufvar} << ::Herb::Engine.js((#{code}));"
        when :style_content
          " #{@bufvar} << ::Herb::Engine.css((#{code}));"
        else
          # Default HTML content escaping
          if @escape
            " #{@bufvar} << #{@escapefunc}((#{code}));"
          else
            " #{@bufvar} << (#{code}).to_s;"
          end
        end
      end

      # Optimize tokens by merging adjacent text tokens
      def optimize_tokens(tokens)
        return tokens if tokens.empty?

        optimized = []
        current_text = ""
        current_context = nil

        tokens.each do |type, value, context|
          if type == :text
            # For text tokens, we can combine them regardless of context
            # since plain text doesn't need context-specific handling
            current_text += value
            # Use the first text token's context as the context for the combined text
            current_context ||= context
          else
            # Flush accumulated text
            if !current_text.empty?
              optimized << [:text, current_text, current_context]
              current_text = ""
              current_context = nil
            end

            # Add non-text token
            optimized << [type, value, context]
          end
        end

        # Flush remaining text
        if !current_text.empty?
          optimized << [:text, current_text, current_context]
        end

        optimized
      end

      # Security validation methods
      def validate_tag_security(node)
        # Check for dangerous ERB output in attribute position
        node.children.each do |child|
          next if child.is_a?(Herb::AST::HTMLAttributeNode)
          next if child.is_a?(Herb::AST::WhitespaceNode)

          if child.is_a?(Herb::AST::ERBContentNode) && erb_outputs?(child)
            raise_security_error(
              "ERB output tags (<%= %>) are not allowed in attribute position.",
              child,
              "Use control flow (<% %>) with static attributes instead."
            )
          end
        end
      end

      def erb_outputs?(node)
        return false unless node.is_a?(Herb::AST::ERBContentNode)
        opening = node.tag_opening&.value
        opening&.include?("=") && !opening&.start_with?("<%#")
      end

      def raise_security_error(message, node, suggestion = nil)
        line = node.respond_to?(:location) && node.location&.start&.line
        column = node.respond_to?(:location) && node.location&.start&.column

        raise Herb::Engine::SecurityError.new(
          message,
          line: line,
          column: column,
          suggestion: suggestion
        )
      end

      def reconstruct_attribute(attribute_node)
        return "" unless attribute_node.is_a?(Herb::AST::HTMLAttributeNode)

        text = +" "

        attribute_node.name.children.each do |child|
          text << extract_text_content(child)
        end

        if attribute_node.value
          text << "="

          if attribute_node.value.quoted
            quote = attribute_node.value.open_quote&.value || '"'
            text << quote

            attribute_node.value.children.each do |child|
              text << extract_text_content(child)
            end

            text << quote
          else
            attribute_node.value.children.each do |child|
              text << extract_text_content(child)
            end
          end
        end

        text
      end

      def extract_text_content(node)
        case node
        when Herb::AST::LiteralNode
          node.content
        when Herb::AST::HTMLTextNode
          node.content
        when Herb::AST::WhitespaceNode
          node.value&.value || ""
        else
          ""
        end
      end
    end
  end
end
