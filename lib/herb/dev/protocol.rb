# frozen_string_literal: true
# typed: true

module Herb
  module Dev
    # Builds the messages the dev server broadcasts, and nothing else.
    #
    # Everything here is a pure function from what the pipeline knows to a Hash the socket
    # writes out, so the whole protocol is testable without a connection.
    #
    # A `schema` message always carries `diagnostics`, and an empty array means the file is
    # clean now. That is the whole error lifecycle. There is no separate message for a file
    # being fixed.
    #
    module Protocol
      MAX_REMAP_OPERATIONS = 32 #: Integer
      NULLING_TYPES = [:node_replaced, :node_wrapped, :node_unwrapped, :tag_name_changed].freeze #: Array[Symbol]

      REPLAYED_TYPES = [
        :node_inserted, :node_removed, :node_replaced, :node_wrapped, :node_unwrapped,
        :tag_name_changed, :text_changed, :attribute_added, :attribute_removed,
        :attribute_value_changed, :erb_content_changed, :whitespace_changed
      ].freeze #: Array[Symbol]

      #: (file: String, mode: Symbol?, from: String?, to: String?, ?manifest: Hash[String, untyped]?, ?static_markup: String?, ?statics: Hash[String, String]?, ?changed_statics: Array[String]?, ?remap: Hash[String, untyped]?, ?diagnostics: Array[Hash[Symbol, untyped]], ?source: String?) -> Hash[Symbol, untyped]
      def self.schema(file:, mode:, from:, to:, manifest: nil, static_markup: nil, statics: nil, changed_statics: nil, remap: nil, diagnostics: [], source: nil)
        {
          type: "schema",
          file: file,
          mode: mode&.to_s,
          version: { from: from, to: to },
          manifest: manifest,
          static_markup: static_markup,
          statics: statics,
          changed_statics: changed_statics,
          remap: remap,
          diagnostics: diagnostics,
          source: source,
        }
      end

      #: (file: String, version: String?, node_path: Array[Integer], scope: Symbol) -> Hash[Symbol, untyped]
      def self.invalidate(file:, version:, node_path:, scope:)
        {
          type: "invalidate",
          file: file,
          version: version,
          node_path: node_path,
          scope: scope.to_s,
        }
      end

      #: (kind: Symbol, file: String) -> Hash[Symbol, untyped]
      def self.asset(kind:, file:)
        {
          type: "asset",
          kind: kind.to_s,
          file: file,
        }
      end

      #: (file: String, source: String, errors: Array[untyped]) -> Hash[Symbol, untyped]
      def self.error(file:, source:, errors:)
        entries = errors.map { |parse_error|
          diagnostic = parse_error.to_diagnostic(template: file)

          {
            name: parse_error.error_name,
            code: diagnostic.code,
            origin: diagnostic.origin,
            message: diagnostic.message,
            suggestion: diagnostic.suggestion,
            line: parse_error.location.start.line,
            column: parse_error.location.start.column,
          }
        }

        { type: "error", file: file, source: source, errors: entries }
      end

      #: (Array[Hash[Symbol, untyped]], Array[Hash[Symbol, untyped]], Array[Herb::Diff::Operation]) -> Hash[String, untyped]?
      def self.remap(old_slots, new_slots, operations)
        return nil unless replayable?(operations)

        removals = operations.select { |operation| operation.type.to_s == "node_removed" }
        insertions = operations.select { |operation| operation.type.to_s == "node_inserted" }
        nulling = operations.select { |operation| NULLING_TYPES.include?(operation.type.to_s.to_sym) }

        named = {} #: Hash[String, Hash[Symbol, untyped]]

        new_slots.each { |entry| named[entry[:name]] = entry if entry[:name] }

        slots = {} #: Hash[String, untyped]

        old_slots.each { |old|
          slots[old[:index].to_s] = target_for(old, new_slots, named, removals, insertions, nulling)
        }

        contested = slots.values.compact.tally.select { |_, count| count > 1 }

        slots.transform_values! { |target| target && contested.key?(target) ? nil : target }

        { "slots" => slots }
      end

      #: (Hash[Symbol, untyped], Array[Hash[Symbol, untyped]], Hash[String, Hash[Symbol, untyped]], Array[Herb::Diff::Operation], Array[Herb::Diff::Operation], Array[Herb::Diff::Operation]) -> Integer?
      def self.target_for(old, new_slots, named, removals, insertions, nulling)
        return named.fetch(old[:name])[:index] if old[:name] && named.key?(old[:name])

        path = replay(old[:node_path], removals, insertions, nulling)

        return nil unless path

        matches = new_slots.select { |entry| counterpart?(entry, old, path) }

        return nil unless matches.length == 1

        matches.fetch(0)[:index]
      end

      #: (Array[Integer], Array[Herb::Diff::Operation], Array[Herb::Diff::Operation], Array[Herb::Diff::Operation]) -> Array[Integer]?
      def self.replay(node_path, removals, insertions, nulling)
        path = node_path.dup

        return nil if nulled?(nulling, path)

        removals.sort_by { |operation| -operation.path.last }.each do |operation|
          removed = operation.path

          return nil if prefix?(removed, path)

          path[removed.length - 1] -= 1 if sibling_before?(removed, path)
        end

        return nil if nulled?(nulling, path)

        insertions.sort_by { |operation| operation.path.last }.each do |operation|
          inserted = operation.path

          path[inserted.length - 1] += 1 if sibling_at_or_before?(inserted, path)
        end

        return nil if nulled?(nulling, path)

        path
      end

      #: (Array[Herb::Diff::Operation]) -> bool
      def self.replayable?(operations)
        operations.length <= MAX_REMAP_OPERATIONS &&
          operations.all? { |operation| REPLAYED_TYPES.include?(operation.type.to_s.to_sym) } &&
          operations.none? { |operation| operation.path.empty? }
      end

      #: (Hash[Symbol, untyped], Hash[Symbol, untyped], Array[Integer]) -> bool
      def self.counterpart?(entry, old, path)
        entry[:node_path] == path && entry[:type] == old[:type] && entry[:attribute] == old[:attribute] && entry[:name].nil?
      end

      #: (Array[Herb::Diff::Operation], Array[Integer]) -> bool
      def self.nulled?(nulling, path)
        nulling.any? { |operation| prefix?(operation.path, path) }
      end

      #: (Array[Integer], Array[Integer]) -> bool
      def self.prefix?(candidate, path)
        candidate.length <= path.length && path.first(candidate.length) == candidate
      end

      #: (Array[Integer], Array[Integer]) -> bool
      def self.sibling_before?(operation_path, path)
        same_parent?(operation_path, path) && sibling_index(operation_path, path) > operation_index(operation_path)
      end

      #: (Array[Integer], Array[Integer]) -> bool
      def self.sibling_at_or_before?(operation_path, path)
        same_parent?(operation_path, path) && sibling_index(operation_path, path) >= operation_index(operation_path)
      end

      #: (Array[Integer], Array[Integer]) -> bool
      def self.same_parent?(operation_path, path)
        parent = operation_path[0...-1] || []

        path.length >= operation_path.length && path.first(parent.length) == parent
      end

      #: (Array[Integer], Array[Integer]) -> Integer
      def self.sibling_index(operation_path, path)
        path.fetch(operation_path.length - 1)
      end

      #: (Array[Integer]) -> Integer
      def self.operation_index(operation_path)
        operation_path.fetch(-1)
      end
    end
  end
end
