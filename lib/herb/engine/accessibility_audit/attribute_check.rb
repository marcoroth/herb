# frozen_string_literal: true
# typed: false

require_relative "checks"
require_relative "text"

module Herb
  class Engine
    module AccessibilityAudit
      # Checks that judge the value an ERB expression rendered into an attribute.
      #
      # TODO: Delegate to the corresponding linter rules once the linter is callable from Ruby.
      #
      # The predicates here duplicate logic the linter already owns: `a11y-no-redundant-image-alt`,
      # `html-aria-role-must-be-valid`, `html-no-abstract-roles`, `html-no-positive-tab-index`,
      # `html-aria-attribute-must-be-valid`, `html-no-duplicate-ids`, `html-anchor-require-href`,
      # and `html-iframe-has-title`.
      #
      # Those rules deliberately bail out on dynamic values (`hasDynamicAttributeValue(node)` and
      # friends), which is exactly the case this audit covers, and `AttributeVisitorMixin` already
      # splits its hooks along that line: `checkStaticAttributeStaticValue` takes an attribute name
      # and a resolved value string, which is what `violation` is handed at render time. So the call
      # the visitor compiles already carries everything a rule needs (element, attribute, value, and
      # source location), and only this module would change.
      #
      # Delegating would also let `.herb.yml` linter configuration (enabled rules, severities) govern
      # the audit, instead of the separate `disabled_checks` list.
      #
      # Not everything maps: `blank-alt-text` (the rule only requires `alt` to be present) and
      # `invalid-lang` have no rule counterpart today, and would stay here or become new rules.
      module AttributeCheck
        REDUNDANT_ALT_PREFIXES = [
          "image of", "picture of", "photo of", "photograph of", "graphic of", "icon of", "image:",
          "photo:", "picture:", "icon:"
        ].freeze

        ABSTRACT_ROLES = [
          "command", "composite", "input", "landmark", "range", "roletype", "section", "sectionhead",
          "select", "structure", "widget", "window"
        ].freeze

        VALID_ROLES = (ABSTRACT_ROLES + [
          "alert", "alertdialog", "application", "article", "banner", "blockquote", "button", "caption",
          "cell", "checkbox", "code", "columnheader", "combobox", "complementary", "contentinfo",
          "definition", "deletion", "dialog", "directory", "document", "emphasis", "feed", "figure",
          "form", "generic", "grid", "gridcell", "group", "heading", "img", "insertion", "link", "list",
          "listbox", "listitem", "log", "main", "mark", "marquee", "math", "menu", "menubar", "menuitem",
          "menuitemcheckbox", "menuitemradio", "meter", "navigation", "none", "note", "option",
          "paragraph", "presentation", "progressbar", "radio", "radiogroup", "region", "row", "rowgroup",
          "rowheader", "scrollbar", "search", "searchbox", "separator", "slider", "spinbutton", "status",
          "strong", "subscript", "superscript", "switch", "tab", "table", "tablist", "tabpanel", "term",
          "textbox", "time", "timer", "toolbar", "tooltip", "tree", "treegrid", "treeitem"
        ]).freeze

        LANGUAGE_TAG = /\A[a-z]{2,3}(-[a-z0-9]{2,8})*\z/i

        class << self
          #: (Symbol, String?, String, String, ?ids: Hash[String, bool]?) -> String?
          def violation(check, value, element, attribute, ids: nil)
            case check
            when :blank_alt_text
              blank_alt_text(value, element)
            when :redundant_alt_text
              redundant_alt_text(value, element)
            when :blank_aria_label
              blank_aria_label(value, element)
            when :blank_href
              blank_href(value)
            when :blank_frame_title
              blank_frame_title(value, element)
            when :duplicate_id
              duplicate_id(value, ids)
            when :invalid_lang
              invalid_lang(value, element)
            when :invalid_role
              invalid_role(value, element)
            when :positive_tabindex
              positive_tabindex(value, element)
            when :invalid_aria_value
              invalid_aria_value(value, element, attribute)
            end
          end

          private

          #: (String?, String) -> String?
          def blank_alt_text(value, element)
            return unless Text.blank?(value)

            "`<#{element} alt>` rendered blank. Provide alt text describing the image, or write a literal `alt=\"\"` when the image is decorative."
          end

          #: (String?, String) -> String?
          def redundant_alt_text(value, element)
            return if Text.blank?(value)

            normalized = value.to_s.strip.downcase
            prefix = REDUNDANT_ALT_PREFIXES.find { |candidate| normalized.start_with?(candidate) }

            return unless prefix

            "`<#{element} alt>` rendered #{value.to_s.strip.inspect}, which starts with #{prefix.inspect}. Screen readers already announce the element as an image."
          end

          #: (String?, String) -> String?
          def blank_aria_label(value, element)
            return unless Text.blank?(value)

            "`aria-label` on `<#{element}>` rendered blank, leaving the element without an accessible name."
          end

          #: (String?) -> String?
          def blank_href(value)
            return unless Text.blank?(value)

            "`<a href>` rendered blank, which links back to the current page."
          end

          #: (String?, String) -> String?
          def blank_frame_title(value, element)
            return unless Text.blank?(value)

            "`<#{element} title>` rendered blank, leaving the frame without an accessible name."
          end

          #: (String?, Hash[String, bool]?) -> String?
          def duplicate_id(value, ids)
            return if ids.nil?
            return if Text.blank?(value)

            id = value.to_s

            unless ids.key?(id)
              ids[id] = true

              return nil
            end

            "`id=#{id.inspect}` was rendered more than once. IDs have to be unique within a document, and duplicates break `label[for]`, `aria-labelledby`, and in-page anchors."
          end

          #: (String?, String) -> String?
          def invalid_lang(value, element)
            return "`<#{element} lang>` rendered blank, which does not declare a language." if Text.blank?(value)
            return if value.to_s.strip.match?(LANGUAGE_TAG)

            "`<#{element} lang>` rendered #{value.to_s.strip.inspect}, which is not a valid BCP 47 language tag."
          end

          #: (String?, String) -> String?
          def invalid_role(value, element)
            return "`<#{element} role>` rendered blank." if Text.blank?(value)

            roles = value.to_s.strip.downcase.split(/\s+/)
            unknown = roles.reject { |role| VALID_ROLES.include?(role) }

            if unknown.any?
              return "`<#{element} role>` rendered #{unknown.first.inspect}, which is not a valid ARIA role."
            end

            abstract = roles.select { |role| ABSTRACT_ROLES.include?(role) }

            return if abstract.empty?

            "`<#{element} role>` rendered #{abstract.first.inspect}, which is an abstract role and must not be used in markup."
          end

          #: (String?, String) -> String?
          def positive_tabindex(value, element)
            return if Text.blank?(value)

            tabindex = Integer(value.to_s.strip, exception: false)

            return if tabindex.nil? || tabindex <= 0

            "`<#{element} tabindex>` rendered #{value.to_s.strip.inspect}. Positive `tabindex` values override the natural focus order and are almost always a bug."
          end

          #: (String?, String, String) -> String?
          def invalid_aria_value(value, element, attribute)
            allowed = Checks::ARIA_VALUES[attribute]

            return unless allowed
            return if value.nil?

            normalized = value.to_s.strip.downcase

            return if normalized.empty?
            return if allowed.include?(normalized)

            "`<#{element} #{attribute}>` rendered #{value.to_s.strip.inspect}. Allowed values are #{allowed.join(", ")}."
          end
        end
      end
    end
  end
end
