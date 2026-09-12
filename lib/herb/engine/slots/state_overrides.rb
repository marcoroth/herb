# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Slots
      # Resolves the state values a client sent along with a values request.
      #
      # The values program evaluates the branch the state picks, so a client that wants the
      # values for its own branches sends its state and the program initializes each declared
      # state from it. A host makes that possible by answering `__herb_state_overrides` in the
      # render context with a hash keyed by template identifier. Everything here degrades to
      # the compiled defaults, since a missing, malformed or wrongly typed override must never
      # break a render the defaults could serve.
      #
      module StateOverrides
        HOOK = "__herb_state_overrides" #: String

        #: (untyped, String) -> Hash[String, untyped]?
        def self.resolve(raw, identifier)
          return nil unless raw.is_a?(Hash)

          overrides = raw[identifier]

          overrides.is_a?(Hash) ? overrides : nil
        end

        #: (Hash[String, untyped]?, String, Symbol) { () -> untyped } -> untyped
        def self.fetch(overrides, name, kind)
          return yield if overrides.nil? || !overrides.key?(name)

          coerced = coerce(overrides[name], kind)

          coerced == :__herb_uncoercible ? yield : coerced
        end

        #: (untyped, Symbol) -> untyped
        def self.coerce(value, kind)
          return :__herb_uncoercible unless value.nil? || value.is_a?(String) || value.is_a?(Integer) || value.is_a?(Float) || value == true || value == false

          case kind
          when :boolean
            return value if [true, false].include?(value)
            return value == "true" if ["true", "false"].include?(value)

            :__herb_uncoercible
          when :integer
            return value if value.is_a?(Integer)
            return value.to_i if value.is_a?(String) && value.strip.match?(/\A-?\d+\z/)

            :__herb_uncoercible
          when :string, :symbol
            return :__herb_uncoercible if value.nil?

            string = value.is_a?(String) ? value : value.to_s

            kind == :symbol ? string.to_sym : string
          else
            value
          end
        end
      end
    end
  end
end
