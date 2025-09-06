# frozen_string_literal: true
# typed: true

module Herb
  module Warnings
    class Warning
      #: String
      attr_reader :name
      #: String
      attr_reader :type
      #: Herb::Location
      attr_reader :location
      #: String
      attr_reader :message

      #: (String, Herb::Location, String) -> void
      def initialize(type, location, message)
        @type = type
        @location = location
        @message = message
      end

      #: type serialized_warning = { type: String, location: {start: Herb::Position, end: Herb::Position}, message: String }
      #: () -> serialized_warning
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
