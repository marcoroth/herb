# frozen_string_literal: true
# typed: true

module Herb
  module Warnings
    class Warning
      attr_reader :type #: String
      attr_reader :location #: Location?
      attr_reader :message #: String

      #: (String, Location?, String) -> void
      def initialize(type, location, message)
        @type = type
        @location = location
        @message = message
      end

      #: () -> serialized_warning
      def to_hash
        {
          type: type,
          location: location&.to_hash,
          message: message,
        }
      end

      #: (Hash[untyped, untyped]) -> Warning
      def self.from_hash(data)
        type = data[:type] || data["type"] || ""
        location = Location.from_hash(data[:location] || data["location"])
        message = data[:message] || data["message"] || ""

        new(type, location, message)
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
