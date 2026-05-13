# frozen_string_literal: true
# typed: true

module Herb
  class Linter
    class Rule
      #: () -> String
      def name
        raise NotImplementedError, "#{self.class}#name must be implemented"
      end

      #: () -> Symbol
      def severity
        :error
      end

      #: () -> bool
      def enabled?
        true
      end

      #: (Herb::ParseResult, Hash[Symbol, untyped]) -> Array[Offense]
      def check(parse_result, context = {})
        raise NotImplementedError, "#{self.class}#check must be implemented"
      end

      protected

      #: (String, Herb::Location) -> Offense
      def offense(message, location)
        Offense.new(
          name,
          name,
          "",
          message,
          severity.to_s,
          location
        )
      end
    end
  end
end
