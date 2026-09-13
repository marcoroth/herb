# frozen_string_literal: true
# rbs_inline: enabled

require_relative "elements"

module Herb
  module HTML
    module Util
      VOID_ELEMENTS = Elements::VOID_ELEMENTS #: Array[String]
      RCDATA_ELEMENTS = Elements::RCDATA_ELEMENTS #: Array[String]
      RAW_TEXT_ELEMENTS = Elements::RAW_TEXT_ELEMENTS #: Array[String]
      BOOLEAN_ATTRIBUTES = Elements::BOOLEAN_ATTRIBUTES #: Array[String]

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
