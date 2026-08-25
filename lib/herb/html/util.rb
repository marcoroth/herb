# frozen_string_literal: true
# rbs_inline: enabled

module Herb
  module HTML
    module Util
      # TODO: extract to shared utility for all languages in .yml
      VOID_ELEMENTS = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].freeze #: Array[String]
      RCDATA_ELEMENTS = ["textarea", "title"].freeze #: Array[String]
      RAW_TEXT_ELEMENTS = ["script", "style", "xmp", "iframe", "noembed", "noframes", "plaintext"].freeze #: Array[String]

      # https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes
      BOOLEAN_ATTRIBUTES = [
        "allowfullscreen", "async", "autofocus", "autoplay", "checked", "compact",
        "controls", "declare", "default", "defer", "disabled", "formnovalidate",
        "hidden", "inert", "ismap", "itemscope", "loop", "multiple", "muted",
        "nomodule", "nohref", "noresize", "noshade", "novalidate", "nowrap",
        "open", "playsinline", "readonly", "required", "reversed", "scoped",
        "seamless", "selected", "sortable", "truespeed", "typemustmatch"
      ].freeze #: Array[String]

      #: (String) -> bool
      def self.void_element?(tag_name)
        VOID_ELEMENTS.include?(tag_name.downcase)
      end

      #: (String) -> bool
      def self.rcdata_element?(tag_name)
        RCDATA_ELEMENTS.include?(tag_name.downcase)
      end

      #: (String) -> bool
      def self.raw_text_element?(tag_name)
        RAW_TEXT_ELEMENTS.include?(tag_name.downcase)
      end

      #: (String) -> bool
      def self.boolean_attribute?(attribute_name)
        BOOLEAN_ATTRIBUTES.include?(attribute_name.downcase)
      end
    end
  end
end
