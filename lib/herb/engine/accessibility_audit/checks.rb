# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    module AccessibilityAudit
      # The catalog of what gets checked where.
      #
      # `Visitor` reads it at compile time to decide what to instrument, and the
      # audit reads it at render time to decide which checks a value has to pass.
      module Checks
        ATTRIBUTE = {
          "alt" => { elements: ["img", "area", "input"], checks: [:blank_alt_text, :redundant_alt_text] },
          "aria-label" => { elements: :any, checks: [:blank_aria_label] },
          "href" => { elements: ["a"], checks: [:blank_href] },
          "id" => { elements: :any, checks: [:duplicate_id] },
          "lang" => { elements: :any, checks: [:invalid_lang] },
          "role" => { elements: :any, checks: [:invalid_role] },
          "tabindex" => { elements: :any, checks: [:positive_tabindex] },
          "title" => { elements: ["iframe", "frame"], checks: [:blank_frame_title] },
        }.freeze

        CONTENT = {
          "a" => [:empty_link_text, :generic_link_text],
          "button" => [:empty_button_text],
          "h1" => [:empty_heading],
          "h2" => [:empty_heading],
          "h3" => [:empty_heading],
          "h4" => [:empty_heading],
          "h5" => [:empty_heading],
          "h6" => [:empty_heading],
          "label" => [:empty_label],
          "summary" => [:empty_summary],
        }.freeze

        BOOLEAN_ARIA_VALUES = ["true", "false"].freeze

        ARIA_VALUES = {
          "aria-atomic" => BOOLEAN_ARIA_VALUES,
          "aria-busy" => BOOLEAN_ARIA_VALUES,
          "aria-checked" => ["true", "false", "mixed", "undefined"],
          "aria-current" => ["true", "false", "page", "step", "location", "date", "time"],
          "aria-disabled" => BOOLEAN_ARIA_VALUES,
          "aria-expanded" => ["true", "false", "undefined"],
          "aria-haspopup" => ["true", "false", "menu", "listbox", "tree", "grid", "dialog"],
          "aria-hidden" => ["true", "false", "undefined"],
          "aria-live" => ["off", "polite", "assertive"],
          "aria-modal" => BOOLEAN_ARIA_VALUES,
          "aria-multiline" => BOOLEAN_ARIA_VALUES,
          "aria-multiselectable" => BOOLEAN_ARIA_VALUES,
          "aria-orientation" => ["horizontal", "vertical", "undefined"],
          "aria-pressed" => ["true", "false", "mixed", "undefined"],
          "aria-readonly" => BOOLEAN_ARIA_VALUES,
          "aria-required" => BOOLEAN_ARIA_VALUES,
          "aria-selected" => ["true", "false", "undefined"],
          "aria-sort" => ["ascending", "descending", "none", "other"],
        }.freeze

        ALL = (
          ATTRIBUTE.values.flat_map { |entry| entry[:checks] } +
          CONTENT.values.flatten +
          [:invalid_aria_value]
        ).uniq.freeze

        class << self
          #: (String, String) -> Array[Symbol]
          def for_attribute(element, attribute)
            checks = [] #: Array[Symbol]

            entry = ATTRIBUTE[attribute]

            if entry && (entry[:elements] == :any || entry[:elements].include?(element))
              checks.concat(entry[:checks])
            end

            checks << :invalid_aria_value if ARIA_VALUES.key?(attribute)

            checks
          end

          #: (String) -> Array[Symbol]
          def for_content(element)
            CONTENT[element] || []
          end
        end
      end
    end
  end
end
