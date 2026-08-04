# frozen_string_literal: true
# typed: true

module Herb
  module Warnings
    #: type serialized_warning = {
    #|  type: String,
    #|  location: serialized_location?,
    #|  message: String
    #| }

    class Warning
      attr_reader :type #: String
      attr_reader :location #: Location?
      attr_reader :message #: String

      #: (String, Location, String) -> void
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

    # TODO: move to `config.yml` so they are in line with the way errors are defined and generated.
    class UnkeyedCollectionWarning < Warning
      attr_reader :expression #: String?

      attr_reader :tag_name #: String?

      #: (Location, ?String?, ?tag_name: String?) -> void
      def initialize(location, expression = nil, tag_name: nil)
        @expression = expression
        @tag_name = tag_name

        remediation =
          if tag_name
            "Add a `herb-key` or `id` attribute to `<#{tag_name}>`"
          else
            "Add a `<%# herb:key ... %>` directive to this collection, or wrap each row in a single element with a `herb-key` or `id` attribute,"
          end

        super(
          "unkeyed_collection",
          location,
          "#{remediation} so rows can be matched across updates. Without a key, inserting or reordering the collection re-renders every following row and discards its focus, scroll, and input state."
        )
      end
    end
  end
end
