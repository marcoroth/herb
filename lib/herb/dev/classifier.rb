# frozen_string_literal: true
# typed: true

require_relative "../../herb"

module Herb
  module Dev
    # Says what kind of change an edit to a template is.
    #
    # The watcher hands it the previous and current source, and everything downstream decides
    # what to do from the kind alone. `:none` and `:whitespace` render the same as before, so
    # nothing needs to happen. `:static` moved markup without touching any ERB. `:dynamic` is
    # everything else. `:parse_error` carries the errors instead of a diff.
    #
    # The kinds are ordered checks, and the whitespace check has to come before the patchable
    # one. `whitespace_changed` is not a patchable operation, so a reindent classified in the
    # wrong order would read as `:dynamic` and cost a page reload.
    #
    # The diff parses without the configured ERB openers, so a custom opener reads as text on
    # both sides and its edits would pass the patchable check. With openers configured, no
    # change classifies better than `:dynamic`.
    #
    class Classifier
      PATCHABLE_TYPES = ["text_changed", "attribute_value_changed", "attribute_added", "attribute_removed"].freeze #: Array[String]

      Classification = Data.define(
        :kind,       #: Symbol
        :operations, #: Array[Herb::Diff::Operation]
        :node_path,  #: Array[Integer]
        :errors      #: Array[Herb::Errors::Error]
      )

      #: (Array[Herb::Diff::Operation]) -> bool
      def self.can_patch?(operations)
        operations.all? { |operation|
          next false unless PATCHABLE_TYPES.include?(operation.type.to_s)
          next false if operation.new_node&.type&.to_s&.include?("ERB")
          next false if operation.old_node&.type&.to_s&.include?("ERB")

          true
        }
      end

      #: (?configuration: Herb::Configuration?) -> void
      def initialize(configuration: nil)
        @parser_options = configuration&.parser_options || {} #: Hash[Symbol, untyped]
      end

      #: (String, String) -> Classification
      def call(previous, current)
        parse = Herb.parse(current, strict: true, analyze: true, **@parser_options)

        return classification(:parse_error, errors: parse.errors) if parse.errors.any?

        diff = Herb.diff(previous, current, track_whitespace_changes: true)

        return classification(:none) if diff.identical?

        operations = diff.operations
        significant = operations.reject { |operation| operation.type.to_s == "whitespace_changed" }

        return classification(:whitespace, operations: operations) if significant.empty?

        kind = self.class.can_patch?(significant) && @parser_options.empty? ? :static : :dynamic

        classification(kind, operations: operations, node_path: covering_path(significant))
      end

      private

      #: (Symbol, ?operations: Array[Herb::Diff::Operation], ?node_path: Array[Integer], ?errors: Array[Herb::Errors::Error]) -> Classification
      def classification(kind, operations: [], node_path: [], errors: [])
        Classification.new(kind: kind, operations: operations, node_path: node_path, errors: errors)
      end

      #: (Array[Herb::Diff::Operation]) -> Array[Integer]
      def covering_path(operations)
        paths = operations.map(&:path)

        paths.reduce { |common, path| common.zip(path).take_while { |left, right| left == right }.map(&:first) } || []
      end
    end
  end
end
