# frozen_string_literal: true

module Herb
  class Engine
    class ValidationErrorOverlay
      CONTEXT_LINES = 2

      VALIDATOR_BADGES = {
        "SecurityValidator" => { label: "Security", color: "#dc2626" },
        "NestingValidator" => { label: "Nesting", color: "#f59e0b" },
        "AccessibilityValidator" => { label: "A11y", color: "#3b82f6" },
      }.freeze

      SEVERITY_COLORS = {
        "error" => "#dc2626",
        "warning" => "#f59e0b",
        "info" => "#3b82f6",
      }.freeze

      def initialize(source, error, filename: nil)
        @source = source
        @error = error
        @filename = filename || "unknown"
        @lines = source.lines
      end

      def generate_fragment
        location = @error[:location]
        line_num = location&.start&.line || 1
        col_num = location&.start&.column || 1

        validator_info = VALIDATOR_BADGES[@error[:source]] || { label: @error[:source], color: "#6b7280" }
        severity_color = SEVERITY_COLORS[@error[:severity].to_s] || "#6b7280"

        code_snippet = generate_code_snippet(line_num, col_num)

        <<~HTML
          <div class="herb-validation-item" data-severity="#{escape_attr(@error[:severity].to_s)}">
            <div class="herb-validation-header">
              <span class="herb-validation-badge" style="background: #{validator_info[:color]}">
                #{escape_html(validator_info[:label])}
              </span>
              <span class="herb-validation-location">
                #{escape_html(@filename)}:#{line_num}:#{col_num}
              </span>
            </div>
            <div class="herb-validation-message" style="color: #{severity_color}">
              #{escape_html(@error[:message])}
            </div>
            #{code_snippet}
            #{generate_suggestion_html if @error[:suggestion]}
          </div>
        HTML
      end

      private

      def generate_code_snippet(line_num, col_num)
        start_line = [line_num - CONTEXT_LINES, 1].max
        end_line = [line_num + CONTEXT_LINES, @lines.length].min

        code_lines = [] #: Array[String]
        (start_line..end_line).each do |line|
          line_content = @lines[line - 1] || ""
          is_error_line = line == line_num

          highlighted_content = syntax_highlight(line_content.chomp)

          if is_error_line
            code_lines << <<~HTML
              <div class="herb-code-line herb-error-line">
                <div class="herb-line-number">#{line}</div>
                <div class="herb-line-content">#{highlighted_content}</div>
              </div>
            HTML

            if col_num.positive?
              pointer = "#{" " * (col_num - 1)}^"
              code_lines << <<~HTML
                <div class="herb-error-pointer">#{escape_html(pointer)}</div>
              HTML
            end
          else
            code_lines << <<~HTML
              <div class="herb-code-line">
                <div class="herb-line-number">#{line}</div>
                <div class="herb-line-content">#{highlighted_content}</div>
              </div>
            HTML
          end
        end

        <<~HTML
          <div class="herb-code-snippet">
            #{code_lines.join}
          </div>
        HTML
      end

      def generate_suggestion_html
        <<~HTML
          <div class="herb-validation-suggestion">
            <span class="herb-suggestion-icon">💡</span>
            #{escape_html(@error[:suggestion])}
          </div>
        HTML
      end

      def syntax_highlight(code)
        lex_result = ::Herb.lex(code)
        return escape_html(code) if lex_result.errors.any?

        tokens = lex_result.value
        highlight_with_tokens(tokens, code)
      rescue StandardError
        escape_html(code)
      end

      def highlight_with_tokens(tokens, code)
        return escape_html(code) if tokens.nil? || tokens.empty?

        highlighted = ""
        last_end = 0

        tokens.each do |token|
          char_offset = get_character_offset(code, token.location.start.line, token.location.start.column)
          char_end = get_character_offset(code, token.location.end_point.line, token.location.end_point.column)

          highlighted += escape_html(code[last_end...char_offset]) if char_offset > last_end

          token_text = code[char_offset...char_end]
          highlighted += apply_token_style(token, token_text)
          last_end = char_end
        end

        highlighted += escape_html(code[last_end..]) if last_end < code.length

        highlighted
      end

      def get_character_offset(_content, line, column)
        return column - 1 if line == 1

        column - 1
      end

      def apply_token_style(token, text)
        escaped_text = escape_html(text)

        case token.type
        when "TOKEN_ERB_START", "TOKEN_ERB_END"
          "<span class=\"herb-erb\">#{escaped_text}</span>"
        when "TOKEN_ERB_CONTENT"
          "<span class=\"herb-erb-content\">#{escaped_text}</span>"
        when "TOKEN_HTML_TAG_START", "TOKEN_HTML_TAG_START_CLOSE", "TOKEN_HTML_TAG_END", "TOKEN_HTML_TAG_SELF_CLOSE", "TOKEN_IDENTIFIER"
          "<span class=\"herb-tag\">#{escaped_text}</span>"
        when "TOKEN_HTML_ATTRIBUTE_NAME"
          "<span class=\"herb-attr\">#{escaped_text}</span>"
        when "TOKEN_QUOTE", "TOKEN_HTML_ATTRIBUTE_VALUE"
          "<span class=\"herb-value\">#{escaped_text}</span>"
        when "TOKEN_HTML_COMMENT_START", "TOKEN_HTML_COMMENT_END", "TOKEN_HTML_COMMENT_CONTENT"
          "<span class=\"herb-comment\">#{escaped_text}</span>"
        else
          escaped_text
        end
      end

      def escape_html(text)
        text.to_s
            .gsub("&", "&amp;")
            .gsub("<", "&lt;")
            .gsub(">", "&gt;")
            .gsub('"', "&quot;")
            .gsub("'", "&#39;")
      end

      def escape_attr(text)
        escape_html(text).gsub("\n", "&#10;").gsub("\r", "&#13;")
      end
    end
  end
end
