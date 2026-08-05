# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    module AccessibilityAudit
      # Checks that judge the text an element rendered.
      #
      # TODO: Delegate to the corresponding linter rules once the linter is callable from Ruby.
      # `html-no-empty-headings` and `a11y-avoid-generic-link-text` already own two of these, and
      # both bail out when the content of the element is dynamic. `empty-button-text`,
      # `empty-label`, and `empty-summary` have no rule counterpart today.
      module ContentCheck
        GENERIC_LINK_TEXT = [
          "click here", "click this", "click", "here", "this", "this link", "link", "more", "read more",
          "learn more", "see more", "more info", "more information", "details", "download", "go", "start"
        ].freeze

        class << self
          #: (Symbol, String, String) -> String?
          def violation(check, text, element)
            case check
            when :empty_link_text
              "`<a>` rendered without any text, leaving the link without an accessible name." if text.empty?
            when :empty_button_text
              "`<button>` rendered without any text, leaving the button without an accessible name." if text.empty?
            when :empty_heading
              empty_heading(text, element)
            when :empty_label
              "`<label>` rendered without any text, leaving the associated form control unlabeled." if text.empty?
            when :empty_summary
              "`<summary>` rendered without any text, leaving the disclosure control without a name." if text.empty?
            when :generic_link_text
              generic_link_text(text)
            end
          end

          private

          #: (String, String) -> String?
          def empty_heading(text, element)
            return unless text.empty?

            "`<#{element}>` rendered without any text, which leaves an empty heading in the document outline."
          end

          #: (String) -> String?
          def generic_link_text(text)
            return if text.empty?

            normalized = text.downcase.gsub(/[[:punct:]]/, " ").gsub(/\s+/, " ").strip

            return unless GENERIC_LINK_TEXT.include?(normalized)

            "`<a>` rendered the generic link text #{text.inspect}, which does not describe the link target " \
              "when read out of context."
          end
        end
      end
    end
  end
end
