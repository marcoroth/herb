# frozen_string_literal: true
# typed: ignore

module Herb
  module Rubocop
    class Offense
      attr_reader :cop_name, :message, :severity, :location, :correctable

      def initialize(cop_name:, message:, severity:, location:, correctable: false)
        @cop_name = cop_name
        @message = message
        @severity = severity
        @location = location
        @correctable = correctable
      end

      def to_hash
        {
          cop_name: cop_name,
          message: message,
          severity: severity,
          location: location.to_hash,
          correctable: correctable,
        }
      end
    end
  end
end
