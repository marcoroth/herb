# frozen_string_literal: true
# typed: true

module Herb
  # A parsed template whose native syntax tree is retained for efficient,
  # repeated diffing. `Herb.diff` accepts a DiffableTree in place of a source
  # string on either side, skipping the parse for that side.
  #
  #   baseline = Herb::DiffableTree.parse(previous_html)
  #   result   = Herb.diff(baseline, next_html)
  class DiffableTree
    attr_reader :source #: String

    #: (String, **untyped) -> Herb::DiffableTree
    def self.parse(source, **)
      Herb.__parse_diffable_tree__(source, **)
    end

    private_class_method :new

    #: (Herb::DiffableTree | String other) -> Herb::DiffResult
    def diff(other)
      Herb.diff(self, other)
    end

    #: () -> Herb::ParseResult
    def parse_result
      @parse_result ||= Herb.__diffable_tree_parse_result__(self)
    end

    #: () -> Herb::AST::DocumentNode
    def value
      parse_result.value
    end

    #: () -> Array[Herb::Errors::Error]
    def errors
      parse_result.errors
    end

    #: () -> Array[Herb::Warnings::Warning]
    def warnings
      parse_result.warnings
    end

    #: () -> bool
    def failed?
      parse_result.failed?
    end

    #: () -> bool
    def success?
      parse_result.success?
    end

    #: () -> String
    def inspect
      "#<#{self.class.name} source: #{source.bytesize} bytes>"
    end
  end
end
