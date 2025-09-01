# frozen_string_literal: true

module Herb
  class Engine
    class ParserErrorOverlay
      CONTEXT_LINES = 3

      ERROR_CLASS_PRIORITRY = [
        Herb::Errors::UnexpectedTokenError,
        Herb::Errors::UnexpectedError,
        Herb::Errors::RubyParseError,
        Herb::Errors::QuotesMismatchError,
        Herb::Errors::TagNamesMismatchError,
        Herb::Errors::VoidElementClosingTagError,
        Herb::Errors::UnclosedElementError,
        Herb::Errors::MissingClosingTagError,
        Herb::Errors::MissingOpeningTagError
      ].freeze

      def initialize(source, errors, filename: nil)
        @source = source
        @errors = errors.sort_by { |error|
          [ERROR_CLASS_PRIORITRY.index(error.class) || -1, error.location.start.line, error.location.start.column]
        }
        @filename = filename || "unknown"
        @lines = source.lines
      end

      def generate_html
        return "" if @errors.empty?

        error_count = @errors.length
        error_title = error_count == 1 ? "Template Error" : "Template Errors (#{error_count})"

        primary_error = @errors.first
        error_message = primary_error.respond_to?(:message) ? primary_error.message : primary_error.to_s

        <<~HTML
          <div class="herb-parser-error-overlay">
            <style>
              .herb-parser-error-overlay * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }

              .herb-parser-error-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(4px);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
                color: #e5e5e5;
                line-height: 1.6;
              }

              .herb-parser-error-overlay .herb-error-container {
                background: #000000;
                border: 1px solid #374151;
                border-radius: 12px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                max-width: 1200px;
                max-height: 80vh;
                width: 100%;
                display: flex;
                flex-direction: column;
                overflow: hidden;
              }

              .herb-parser-error-overlay .herb-error-header {
                background: linear-gradient(135deg, #dc2626, #b91c1c);
                padding: 20px 24px;
                border-bottom: 1px solid #374151;
                border-radius: 12px 12px 0 0;
                flex-shrink: 0;
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
              }

              .herb-parser-error-overlay .herb-error-header-content {
                flex: 1;
                min-width: 0;
              }

              .herb-parser-error-overlay .herb-error-title {
                font-size: 18px;
                font-weight: 600;
                color: white;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                gap: 12px;
              }

              .herb-parser-error-overlay .herb-error-icon {
                width: 20px;
                height: 20px;
                background: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: #dc2626;
                font-weight: bold;
              }

              .herb-parser-error-overlay .herb-error-message {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.9);
                font-weight: 400;
              }

              .herb-parser-error-overlay .herb-error-message-section {
                background: #1a1a1a;
                border-bottom: 1px solid #374151;
                padding: 12px 16px;
              }

              .herb-parser-error-overlay .herb-error-message-section .herb-error-message {
                font-size: 13px;
                color: #fbbf24;
                font-weight: 500;
                line-height: 1.4;
              }

              .herb-parser-error-overlay .herb-error-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 24px;
              }

              .herb-parser-error-overlay .herb-code-section {
                background: #111111;
                border: 1px solid #374151;
                border-radius: 8px;
              }

              .herb-parser-error-overlay .herb-code-header {
                background: #262626;
                padding: 12px 16px;
                border-bottom: 1px solid #374151;
                font-size: 13px;
                color: #9ca3af;
                display: flex;
                align-items: center;
                gap: 8px;
              }

              .herb-parser-error-overlay .herb-file-icon {
                width: 20px;
                height: 20px;
                background: #008000;
                border-radius: 2px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
                color: white;
                padding: 2px;
              }

              .herb-parser-error-overlay .herb-code-content {
                padding: 16px;
                overflow-x: auto;
              }

              .herb-parser-error-overlay .herb-code-line {
                display: flex;
                align-items: flex-start;
                min-height: 20px;
                font-size: 13px;
                line-height: 1.5;
              }

              .herb-parser-error-overlay .herb-line-number {
                color: #6b7280;
                width: 40px;
                text-align: right;
                padding-right: 16px;
                user-select: none;
                flex-shrink: 0;
              }

              .herb-parser-error-overlay .herb-line-content {
                flex: 1;
                white-space: pre;
                font-family: inherit;
              }

              .herb-parser-error-overlay .herb-error-line {
                background: rgba(220, 38, 38, 0.1);
                border-left: 3px solid #dc2626;
                margin: 0 -16px;
                padding: 0 16px;
              }

              .herb-parser-error-overlay .herb-error-line .herb-line-number {
                color: #dc2626;
                font-weight: 600;
              }

              .herb-parser-error-overlay .herb-error-line .herb-line-content {
                color: #fecaca;
              }

              .herb-parser-error-overlay .herb-error-pointer {
                color: #dc2626;
                font-weight: bold;
                margin-left: 40px;
                padding-left: 16px;
                font-size: 12px;
              }

              .herb-parser-error-overlay .herb-section {
                background: #111111;
                border: 1px solid #374151;
                border-radius: 8px;
                overflow: hidden;
              }

              .herb-parser-error-overlay .herb-section-header {
                background: #262626;
                padding: 12px 16px;
                border-bottom: 1px solid #374151;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 14px;
                font-weight: 500;
                color: #e5e5e5;
                transition: background-color 0.2s;
              }

              .herb-parser-error-overlay .herb-section-header:hover {
                background: #2d2d2d;
              }

              .herb-parser-error-overlay .herb-section-toggle {
                transition: transform 0.2s;
              }

              .herb-parser-error-overlay .herb-section-toggle.collapsed {
                transform: rotate(-90deg);
              }

              .herb-parser-error-overlay .herb-section-content {
                padding: 16px;
                font-size: 13px;
                line-height: 1.6;
                max-height: 300px;
                overflow-y: auto;
              }

              .herb-parser-error-overlay .herb-section-content.collapsed {
                display: none;
              }

              .herb-parser-error-overlay .herb-suggestions {
                color: #d1d5db;
              }

              .herb-parser-error-overlay .herb-suggestion-item {
                margin-bottom: 12px;
                padding-left: 16px;
                position: relative;
              }

              .herb-parser-error-overlay .herb-suggestion-item::before {
                content: "•";
                color: #10b981;
                position: absolute;
                left: 0;
                font-weight: bold;
              }

              .herb-parser-error-overlay .herb-suggestion-title {
                color: #10b981;
                font-weight: 500;
                margin-bottom: 4px;
              }

              /* Syntax highlighting */
              .herb-parser-error-overlay .herb-keyword { color: #c678dd; }
              .herb-parser-error-overlay .herb-string { color: #98c379; }
              .herb-parser-error-overlay .herb-comment { color: #5c6370; font-style: italic; }
              .herb-parser-error-overlay .herb-tag { color: #e06c75; }
              .herb-parser-error-overlay .herb-attr { color: #d19a66; }
              .herb-parser-error-overlay .herb-value { color: #98c379; }
              .herb-parser-error-overlay .herb-erb {
                color: #61dafb;
                background: rgba(97, 218, 251, 0.1);
                padding: 2px 4px;
                border-radius: 3px;
              }

              @media (max-width: 768px) {
                .herb-parser-error-overlay {
                  padding: 10px;
                }

                .herb-parser-error-overlay .herb-error-container {
                  max-height: 90vh;
                }

                .herb-parser-error-overlay .herb-error-content {
                  padding: 16px;
                  gap: 16px;
                }

                .herb-parser-error-overlay .herb-error-header {
                  padding: 16px;
                  flex-direction: column;
                  align-items: flex-start;
                  gap: 12px;
                }
              }
            </style>

            <div class="herb-error-container">
              <div class="herb-error-header">
                <div class="herb-error-header-content">
                  <div class="herb-error-title">
                    <div class="herb-error-icon">!</div>
                    #{escape_html(error_title)}
                  </div>
                  <div class="herb-error-message">
                    #{escape_html(error_message)}
                  </div>
                </div>
              </div>

              <div class="herb-error-content">
                #{generate_error_sections}
              </div>
            </div>

            <script>
              (function() {
                function toggleSection(sectionId) {
                  const content = document.getElementById(sectionId + '-content');
                  const toggle = document.getElementById(sectionId + '-toggle');

                  if (content && toggle) {
                    if (content.classList.contains('collapsed')) {
                      content.classList.remove('collapsed');
                      toggle.classList.remove('collapsed');
                      toggle.textContent = '▼';
                    } else {
                      content.classList.add('collapsed');
                      toggle.classList.add('collapsed');
                      toggle.textContent = '▶';
                    }
                  }
                }

                function closeErrorOverlay() {
                  const overlay = document.querySelector('.herb-parser-error-overlay');
                  if (overlay) overlay.style.display = 'none';
                }

                // Setup close button
                const closeBtn = document.querySelector('.herb-close-button');
                if (closeBtn) {
                  closeBtn.addEventListener('click', closeErrorOverlay);
                }

                // Close when clicking on backdrop (outside the container)
                const overlay = document.querySelector('.herb-parser-error-overlay');
                const container = document.querySelector('.herb-error-container');
                if (overlay && container) {
                  overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) {
                      closeErrorOverlay();
                    }
                  });
                }

                // Setup section toggles
                document.querySelectorAll('.herb-section-header').forEach(header => {
                  header.addEventListener('click', function() {
                    const sectionId = this.getAttribute('data-section-id');
                    if (sectionId) toggleSection(sectionId);
                  });
                });

                // Close on Escape key
                document.addEventListener('keydown', function(e) {
                  if (e.key === 'Escape') {
                    closeErrorOverlay();
                  }
                });

                // Prevent body scroll when overlay is open
                document.body.style.overflow = 'hidden';

                // Restore scroll when closed (cleanup for navigation)
                const overlay = document.querySelector('.herb-parser-error-overlay');
                if (overlay) {
                  const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        if (overlay.style.display === 'none') {
                          document.body.style.overflow = '';
                        }
                      }
                    });
                  });
                  observer.observe(overlay, { attributes: true });
                }
              })();
            </script>
          </div>
        HTML
      end

      private

      def generate_error_sections
        sections = [] #: Array[String]

        @errors.each_with_index do |error, index|
          sections << generate_code_section(error, index)
        end

        suggestions = @errors.map { |error| get_error_suggestion(error) }.compact

        sections << generate_suggestions_section(suggestions) if suggestions.any?

        sections.uniq.join("\n")
      end

      def generate_code_section(error, index)
        location = error.respond_to?(:location) && error.location ? error.location : nil
        line_num = 1
        col_num = 1

        if location.respond_to?(:start) && location.is_a?(Herb::Location) && location.start
          line_num = location.start.line
          col_num = location.start.column
        end

        error_class = error.class.name.split("::").last.gsub(/Error$/, "")
        error_message = error.respond_to?(:message) ? error.message : error.to_s

        header_text = if @errors.length == 1
                        "#{@filename}:#{line_num}:#{col_num}"
                      else
                        "Error #{index + 1}: #{error_class} - #{@filename}:#{line_num}:#{col_num}"
                      end

        code_lines = generate_code_lines(error, line_num, col_num)

        <<~HTML
          <div class="herb-code-section">
            <div class="herb-code-header">
              <div class="herb-file-icon">ERB</div>
              #{escape_html(header_text)}
            </div>
            <div class="herb-error-message-section">
              <div class="herb-error-message">#{escape_html(error_message)}</div>
            </div>
            <div class="herb-code-content">
              #{code_lines}
            </div>
          </div>
        HTML
      end

      def generate_code_lines(error, line_num, col_num)
        start_line = [line_num - CONTEXT_LINES, 1].max
        end_line = [line_num + CONTEXT_LINES, @lines.length].min

        lines_html = [] #: Array[String]

        (start_line..end_line).each do |i|
          line = @lines[i - 1] || ""
          line_str = line.chomp
          is_error_line = i == line_num

          line_class = is_error_line ? "herb-code-line herb-error-line" : "herb-code-line"

          lines_html << <<~HTML
            <div class="#{line_class}">
              <div class="herb-line-number">#{i}</div>
              <div class="herb-line-content">#{syntax_highlight(line_str)}</div>
            </div>
          HTML

          next unless is_error_line && col_num.positive?

          pointer_text = "^#{"~" * [line_str.length - col_num, 0].max}"
          hint = get_inline_hint(error)
          pointer_display = hint ? "#{pointer_text} #{hint}" : pointer_text

          lines_html << <<~HTML
            <div class="herb-error-pointer">#{" " * (col_num - 1)}#{escape_html(pointer_display)}</div>
          HTML
        end

        lines_html.join("\n")
      end

      def generate_suggestions_section(suggestions)
        suggestion_items = suggestions.map do |suggestion|
          title, description = suggestion.split(": ", 2)
          title ||= "Suggestion"
          description ||= suggestion

          <<~HTML
            <div class="herb-suggestion-item">
              <div class="herb-suggestion-title">#{escape_html(title)}</div>
              <div>#{escape_html(description)}</div>
            </div>
          HTML
        end

        section_id = "suggestions-#{rand(1000)}"

        <<~HTML
          <div class="herb-section">
            <div class="herb-section-header" data-section-id="#{section_id}">
              Suggestions
              <span class="herb-section-toggle" id="#{section_id}-toggle">▼</span>
            </div>
            <div class="herb-section-content" id="#{section_id}-content">
              <div class="herb-suggestions">
                #{suggestion_items.join}
              </div>
            </div>
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
        return escape_html(code) if tokens.empty?

        highlighted = ""
        last_end = 0

        state = {
          in_tag: false,
          in_comment: false,
          tag_name: "",
          is_closing_tag: false,
          expecting_attribute_name: false,
          expecting_attribute_value: false,
          in_quotes: false,
        }

        tokens.each_with_index do |token, i|
          next_token = tokens[i + 1]
          prev_token = tokens[i - 1]

          start_offset = get_character_offset(code, token.location.start.line, token.location.start.column)
          end_offset = get_character_offset(code, token.location.end.line, token.location.end.column)

          highlighted += escape_html(code[last_end...start_offset]) if start_offset > last_end

          token_text = code[start_offset...end_offset]

          update_highlighting_state(state, token, token_text, next_token, prev_token)

          css_class = get_token_css_class(state, token, token_text)

          highlighted += if css_class
                           "<span class=\"herb-#{css_class}\">#{escape_html(token_text)}</span>"
                         else
                           escape_html(token_text)
                         end

          last_end = end_offset
        end

        highlighted += escape_html(code[last_end..]) if last_end < code.length

        highlighted
      end

      def get_character_offset(code, line, column)
        lines = code.lines
        offset = 0

        (1...line).each do |line_num|
          offset += lines[line_num - 1]&.length || 0
        end

        offset + column
      end

      def update_highlighting_state(state, token, token_text, _next_token, _prev_token)
        case token.type
        when "TOKEN_HTML_TAG_START"
          state[:in_tag] = true
          state[:is_closing_tag] = false
          state[:expecting_attribute_name] = false
          state[:expecting_attribute_value] = false

        when "TOKEN_HTML_TAG_START_CLOSE"
          state[:in_tag] = true
          state[:is_closing_tag] = true
          state[:expecting_attribute_name] = false
          state[:expecting_attribute_value] = false

        when "TOKEN_HTML_TAG_END", "TOKEN_HTML_TAG_SELF_CLOSE"
          state[:in_tag] = false
          state[:tag_name] = ""
          state[:is_closing_tag] = false
          state[:expecting_attribute_name] = false
          state[:expecting_attribute_value] = false

        when "TOKEN_IDENTIFIER"
          if state[:in_tag] && state[:tag_name].empty?
            state[:tag_name] = token_text
            state[:expecting_attribute_name] = !state[:is_closing_tag]
          elsif state[:in_tag] && state[:expecting_attribute_name]
            state[:expecting_attribute_name] = false
            state[:expecting_attribute_value] = true
          end

        when "TOKEN_EQUALS"
          state[:expecting_attribute_value] = true if state[:in_tag]

        when "TOKEN_QUOTE"
          if state[:in_tag]
            state[:in_quotes] = !state[:in_quotes]
            unless state[:in_quotes]
              state[:expecting_attribute_name] = true
              state[:expecting_attribute_value] = false
            end
          end

        when "TOKEN_WHITESPACE"
          if state[:in_tag] && !state[:in_quotes] && !state[:tag_name].empty?
            state[:expecting_attribute_name] = true
            state[:expecting_attribute_value] = false
          end

        when "TOKEN_HTML_COMMENT_START"
          state[:in_comment] = true

        when "TOKEN_HTML_COMMENT_END"
          state[:in_comment] = false
        end
      end

      def get_token_css_class(state, token, token_text)
        if state[:in_comment] && !["TOKEN_HTML_COMMENT_START", "TOKEN_HTML_COMMENT_END", "TOKEN_ERB_START",
                                   "TOKEN_ERB_CONTENT", "TOKEN_ERB_END"].include?(token.type)
          return "comment"
        end

        case token.type
        when "TOKEN_ERB_START", "TOKEN_ERB_CONTENT", "TOKEN_ERB_END"
          "erb"
        when "TOKEN_HTML_COMMENT_START", "TOKEN_HTML_COMMENT_END"
          "comment"
        when "TOKEN_HTML_TAG_START", "TOKEN_HTML_TAG_END", "TOKEN_HTML_TAG_START_CLOSE", "TOKEN_HTML_TAG_SELF_CLOSE"
          "tag"
        when "TOKEN_IDENTIFIER"
          if state[:in_tag] && token_text == state[:tag_name]
            "tag"
          elsif state[:in_tag] && (state[:expecting_attribute_name] || state[:expecting_attribute_value])
            state[:in_quotes] ? "value" : "attr"
          end
        when "TOKEN_QUOTE"
          state[:in_tag] ? "value" : nil
        when "TOKEN_STRING"
          state[:in_tag] ? "value" : "string"
        end
      end

      def get_error_suggestion(error)
        case error
        when Herb::Errors::MissingClosingTagError
          if error.respond_to?(:opening_tag) && error.opening_tag
            "Add missing closing tag: Add </#{error.opening_tag.value}> to close the opening tag"
          else
            "Add missing closing tag: Add the missing closing tag"
          end
        when Herb::Errors::MissingOpeningTagError
          if error.respond_to?(:closing_tag) && error.closing_tag
            "Add missing opening tag: Add <#{error.closing_tag.value}> before the closing tag"
          else
            "Add missing opening tag: Add the missing opening tag"
          end
        when Herb::Errors::TagNamesMismatchError
          if error.respond_to?(:opening_tag) && error.respond_to?(:closing_tag) && error.opening_tag && error.closing_tag
            "Fix tag mismatch: Change </#{error.closing_tag.value}> to </#{error.opening_tag.value}>"
          else
            "Fix tag mismatch: Ensure opening and closing tags match"
          end
        when Herb::Errors::VoidElementClosingTagError
          if error.respond_to?(:tag_name) && error.tag_name
            "Remove illegal closing tag: Remove the closing tag for void element <#{error.tag_name.value}>"
          else
            "Remove illegal closing tag: Remove the closing tag for this void element"
          end
        when Herb::Errors::UnclosedElementError
          if error.respond_to?(:opening_tag) && error.opening_tag
            "Close unclosed element: Add </#{error.opening_tag.value}> before the end of the template"
          else
            "Close unclosed element: Close the unclosed element"
          end
        when Herb::Errors::RubyParseError
          "Fix Ruby syntax: Check your Ruby syntax inside the ERB tag"
        when Herb::Errors::QuotesMismatchError
          "Fix quote mismatch: Use matching quotes for attribute values"
        else
          message = error.respond_to?(:message) ? error.message : error.to_s
          "Fix error: #{message}"
        end
      end

      def get_inline_hint(error)
        case error
        when Herb::Errors::MissingClosingTagError
          "← Missing closing tag"
        when Herb::Errors::TagNamesMismatchError
          "← Tag mismatch"
        when Herb::Errors::UnclosedElementError
          "← Unclosed element"
        when Herb::Errors::VoidElementClosingTagError
          "← Void element cannot be closed"
        when Herb::Errors::QuotesMismatchError
          "← Quote mismatch"
        when Herb::Errors::RubyParseError
          "← Ruby syntax error"
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
    end
  end
end
