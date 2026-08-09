# frozen_string_literal: true

require_relative "highlighter_bridge"

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

      def initialize(source, error, filename: nil, overlay_messages: "both", bridge: nil)
        @source = source
        @error = error
        @filename = filename || "unknown"
        @lines = source.lines
        @overlay_messages = overlay_messages
        @bridge = bridge || HighlighterBridge.new
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
        fragment = bridge_fragment

        if fragment
          <<~HTML
            <div class="herb-code-snippet">
              #{fragment}
            </div>
          HTML
        else
          generate_fallback_code_snippet(line_num, col_num)
        end
      end

      def bridge_fragment
        @bridge.html_fragments(
          source: @source,
          errors: [@error],
          filename: @filename,
          context_lines: CONTEXT_LINES,
          messages: @overlay_messages
        ).first
      end

      def generate_fallback_code_snippet(line_num, col_num)
        start_line = [line_num - CONTEXT_LINES, 1].max
        end_line = [line_num + CONTEXT_LINES, @lines.length].min

        code_lines = [] #: Array[String]
        (start_line..end_line).each do |line|
          line_content = @lines[line - 1] || ""
          is_error_line = line == line_num

          escaped_content = escape_html(line_content.chomp)

          if is_error_line
            code_lines << <<~HTML
              <div class="herb-code-line herb-error-line">
                <div class="herb-line-number">#{line}</div>
                <div class="herb-line-content">#{escaped_content}</div>
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
                <div class="herb-line-content">#{escaped_content}</div>
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
