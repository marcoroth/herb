# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      # Points a diagnostic at the part of an expression that is actually wrong.
      #
      # A condition reaches the state compiler as a string that was cut out of an ERB token, so a
      # Prism node inside it knows only its own offset within that string. This carries the token
      # the string came from and turns those offsets back into a location in the template. When it
      # has nothing to work with it answers the whole node's location, which is what every
      # diagnostic used before.
      #
      class StateAnchor
        attr_reader :location #: Herb::Location?

        #: (Herb::Location?, ?token: Herb::Token?, ?expression: String?, ?context: Symbol) -> void
        def initialize(location, token: nil, expression: nil, context: :condition)
          @location = location #: Herb::Location?
          @token = token #: Herb::Token?
          @expression = expression #: String?
          @context = context #: Symbol
        end

        #: () -> bool
        def condition?
          @context == :condition
        end

        #: (::Prism::Node) -> Herb::Location?
        def locate(node)
          return location unless node.respond_to?(:location)

          offset = character_offset(node)

          return location unless offset

          length = node.slice.to_s.length #: Integer

          Herb::Location.new(advance(offset), advance(offset + length))
        end

        private

        #: (::Prism::Node) -> Integer?
        def character_offset(node)
          token = @token
          expression = @expression
          start = @location&.start

          return nil unless token && expression && start

          source = token.value.to_s
          within = source.index(expression)

          return nil unless within

          bytes = node.location.start_offset
          prefix = expression.byteslice(0, bytes)

          return nil unless prefix

          within + prefix.length
        end

        #: (Integer) -> Herb::Position
        def advance(offset)
          anchored = location || Herb::Location.zero
          line = anchored.start.line
          column = anchored.start.column
          consumed = @token&.value.to_s[0, offset].to_s #: String
          breaks = consumed.count("\n") #: Integer

          return Herb::Position.new(line, column + consumed.length) if breaks.zero?

          Herb::Position.new(line + breaks, consumed.length - consumed.rindex("\n").to_i - 1)
        end
      end
    end
  end
end
