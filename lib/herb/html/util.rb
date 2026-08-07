# frozen_string_literal: true
# rbs_inline: enabled

require_relative "elements"

module Herb
  module HTML
    module Util
      VOID_ELEMENTS = Elements::VOID_ELEMENTS #: Array[String]

      #: (String) -> bool
      def self.void_element?(tag_name)
        VOID_ELEMENTS.include?(tag_name.downcase)
      end
    end
  end
end
