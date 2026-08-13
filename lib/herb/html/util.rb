# frozen_string_literal: true
# rbs_inline: enabled

module Herb
  module HTML
    module Util
      # TODO: extract to shared utility for all languages in .yml
      VOID_ELEMENTS = ["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].freeze #: Array[String]
      RCDATA_ELEMENTS = ["textarea", "title"].freeze #: Array[String]
      RAW_TEXT_ELEMENTS = ["script", "style", "xmp", "iframe", "noembed", "noframes", "plaintext"].freeze #: Array[String]

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
    end
  end
end
