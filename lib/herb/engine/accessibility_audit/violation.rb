# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    module AccessibilityAudit
      class Violation
        attr_reader :check #: Symbol
        attr_reader :message #: String
        attr_reader :element #: String
        attr_reader :attribute #: String?
        attr_reader :value #: String?
        attr_reader :file #: String?
        attr_reader :line #: Integer?
        attr_reader :column #: Integer?

        #: (check: Symbol, message: String, element: String, ?attribute: String?, ?value: String?, ?file: String?, ?line: Integer?, ?column: Integer?) -> void
        def initialize(check:, message:, element:, attribute: nil, value: nil, file: nil, line: nil, column: nil)
          @check = check
          @message = message
          @element = element
          @attribute = attribute
          @value = value
          @file = file
          @line = line
          @column = column
        end

        #: () -> String
        def code
          check.to_s.tr("_", "-")
        end

        #: () -> String
        def location
          [file || "(unknown)", line, column].compact.join(":")
        end

        #: () -> String
        def to_s
          "#{location}: [#{code}] #{message}"
        end

        #: () -> Hash[Symbol, untyped]
        def to_h
          {
            code: code,
            message: message,
            element: element,
            attribute: attribute,
            value: value,
            file: file,
            line: line,
            column: column,
          }
        end
      end
    end
  end
end
