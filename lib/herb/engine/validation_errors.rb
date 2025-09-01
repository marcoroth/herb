# frozen_string_literal: true
# typed: false

# rbs_inline: disabled

module Herb
  class Engine
    class SecurityError < StandardError
      attr_reader :line, :column, :filename, :suggestion

      def initialize(message, line: nil, column: nil, filename: nil, suggestion: nil)
        @line = line
        @column = column
        @filename = filename
        @suggestion = suggestion

        super(build_error_message(message))
      end

      private

      def build_error_message(message)
        parts = [] #: Array[String]

        if @filename || (@line && @column)
          location_parts = [] #: Array[String]

          location_parts << @filename if @filename
          location_parts << "#{@line}:#{@column}" if @line && @column

          parts << location_parts.join(":")
        end

        parts << message

        parts << "Suggestion: #{@suggestion}" if @suggestion

        parts.join(" - ")
      end
    end

    module ValidationErrors
      class ValidationError
        attr_reader :type, :location, :message

        def initialize(type, location, message)
          @type = type
          @location = location
          @message = message
        end
      end

      class SecurityValidationError
        attr_reader :type, :location, :message, :suggestion

        def initialize(location, message, suggestion)
          @type = "SecurityError"
          @location = location
          @message = message
          @suggestion = suggestion
        end
      end
    end
  end
end
