# frozen_string_literal: true
# typed: true

module Herb
  module Diff
    class Result
      include Enumerable #[Herb::Diff::Operation]

      attr_reader :operations #: Array[Herb::Diff::Operation]

      #: (bool, Array[Herb::Diff::Operation]) -> void
      def initialize(identical, operations)
        @identical = identical
        @operations = operations.freeze
        freeze
      end

      #: () { (Herb::Diff::Operation) -> void } -> void
      #: () -> Enumerator[Herb::Diff::Operation, void]
      def each(&block)
        return operations.each unless block

        operations.each(&block)
      end

      #: () -> bool
      def identical?
        @identical
      end

      #: () -> Integer
      def operation_count
        operations.size
      end

      #: () -> bool
      def changed?
        !identical?
      end

      #: () -> Hash[Symbol, untyped]
      def to_hash
        {
          identical: identical?,
          operations: operations.map(&:to_hash),
        }
      end

      alias to_h to_hash

      #: () -> String
      def inspect
        if identical?
          "#<#{self.class.name} identical>"
        else
          "#<#{self.class.name} #{operation_count} operation#{"s" unless operation_count == 1}>"
        end
      end
    end
  end
end
