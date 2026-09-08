# frozen_string_literal: true
# typed: true

require_relative "state_kinds"

module Herb
  class Engine
    module Slots
      # Reads the `state:` entries off a render call and answers the call without them.
      #
      # The parser already took the hash apart into one declaration node per entry, with the
      # kind it would give a `herb:state` default, so a value the parser calls bare is a
      # candidate for a binding to one of the caller's states and anything else is a seed.
      # The splice works on the argument's location, turned into an index into the tag's
      # content, so the stripped call is the original source minus exactly the `state:`
      # argument and the comma that carried it.
      #
      module RenderBindings
        BARE_IDENTIFIER = /\A[a-z_][a-zA-Z0-9_]*\z/ #: Regexp

        REFUSED = {
          float: "Ruby and JavaScript disagree on how to print a float, so the server and the client would render different text.",
          array: "A list on the page is a collection of items, not one state holding many values.",
          hash: "A state holds one value the client can write and read back.",
        }.freeze #: Hash[Symbol, String]

        Entry = Data.define(
          :name,      #: String
          :source,    #: String
          :candidate, #: String?
          :kind,      #: Symbol
          :location   #: Herb::Location?
        )

        Analysis = Data.define(
          :entries,  #: Array[Entry]
          :stripped, #: String
          :problems  #: Array[[String, String, Herb::Location?]]
        )

        #: (untyped) -> Analysis?
        def self.analyze(node)
          keywords = node.keywords
          token = node.content
          span = keywords&.state_location

          return nil unless keywords && token && span

          stripped = strip(token, span)

          return nil unless stripped

          entries = [] #: Array[Entry]
          problems = [] #: Array[[String, String, Herb::Location?]]

          keywords.state.each { |state| collect(state, entries, problems) }

          Analysis.new(entries: entries, stripped: stripped, problems: problems)
        end

        #: (untyped, Array[Entry], Array[[String, String, Herb::Location?]]) -> void
        def self.collect(state, entries, problems)
          name = state.name&.value.to_s
          location = state.location

          unless BARE_IDENTIFIER.match?(name)
            problems << ["`#{name}` is not a state name.", "State names are lowercase identifiers, like `open` or `selected_id`.", location]

            return
          end

          if entries.any? { |entry| entry.name == name }
            problems << ["`state:` binds `#{name}` twice.", "Keep one entry for `#{name}`.", location]

            return
          end

          source = state.default_value&.content.to_s
          bare = state.kind == "bare" && BARE_IDENTIFIER.match?(source)
          refused = state.kind.to_s.to_sym

          entries << Entry.new(
            name: name,
            source: source,
            candidate: bare ? source : nil,
            kind: StateKinds::NODE[state.kind] || (REFUSED.key?(refused) ? refused : :seeded),
            location: location
          )
        end

        #: (untyped, Herb::Location) -> String?
        def self.strip(token, span)
          value = token.value
          from = index_in(token, span.start)
          to = index_in(token, span.end)

          return nil unless from && to && from <= to && to <= value.length

          before = value[0...from].to_s
          after = value[to..].to_s

          if after.match?(/\A\s*,/)
            after = after.sub(/\A\s*,\s*/, "")
          else
            before = before.sub(/\s*,\s*\z/, "")
          end

          before + after
        end

        #: (untyped, Herb::Position) -> Integer?
        def self.index_in(token, position)
          start = token.location&.start

          return nil unless start
          return nil if position.line < start.line

          lines = token.value.lines
          skipped = position.line - start.line

          return nil if skipped > lines.length

          column = skipped.zero? ? position.column - start.column : position.column

          return nil if column.negative?

          lines.first(skipped).sum(&:length) + column
        end

        private_class_method :collect, :strip, :index_in
      end
    end
  end
end
