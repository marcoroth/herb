# frozen_string_literal: true
# typed: true

module Herb
  class Linter
    class Backend
      #: () -> bool
      def self.available?
        false
      end

      #: () -> Integer
      def self.rule_count
        0
      end

      #: () -> Array[String]
      def self.rule_names
        []
      end
    end
  end
end
