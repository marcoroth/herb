# frozen_string_literal: true
# typed: true

module Herb
  class DiffResult
    include Enumerable #[Herb::DiffOperation]

    attr_reader :operations #: Array[Herb::DiffOperation]

    #: (bool, Array[Herb::DiffOperation]) -> void
    def initialize(identical, operations)
      @identical = identical
      @operations = operations.freeze
      freeze
    end

    #: () { (Herb::DiffOperation) -> void } -> void
    #: () -> Enumerator[Herb::DiffOperation, void]
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
