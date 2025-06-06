# frozen_string_literal: true
# typed: true

module Herb
  module Warnings
    class Warning
      #: String
      attr_reader :type

      #: Location
      attr_reader :location

      #: String
      attr_reader :message

      #: (String, Location, String) -> void
      def initialize(type, location, message)
        @type = type
        @location = location
        @message = message
      end

      #: () -> { type: String, location: { start: { line: Integer, column: Integer }, end: { line: Integer, column: Integer } }, message: String }
      def to_hash
        {
          type: type,
          location: location.to_hash,
          message: message,
        }
      end

      #: () -> String
      def class_name
        self.class.name || "Warning"
      end

      #: () -> String
      def warning_name
        class_name.split("::").last || "Warning"
      end

      #: (?untyped) -> String
      def to_json(state = nil)
        to_hash.to_json(state)
      end
    end
  end
end
