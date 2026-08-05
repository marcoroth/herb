# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    module AccessibilityAudit
      # Everything the audit remembers while a document renders.
      #
      # A scoped session is one the caller opened deliberately, around a request or a test. Checks
      # that need to see a whole document, such as `duplicate-id`, only run in one, and sampling is
      # decided once per scoped session rather than per value.
      class Session
        attr_reader :violations #: Array[Violation]

        #: (?scoped: bool, ?sampled: bool) -> void
        def initialize(scoped: false, sampled: true)
          @scoped = scoped
          @sampled = sampled
          @violations = [] #: Array[Violation]
          @names = [] #: Array[String?]
          @ids = {} #: Hash[String, bool]
          @reported = {} #: Hash[Array[untyped], bool]
        end

        #: () -> bool
        def scoped?
          @scoped
        end

        #: () -> bool
        def sampled?
          @sampled
        end

        #: () -> Hash[String, bool]?
        def ids
          @scoped ? @ids : nil
        end

        #: (bool) -> void
        def open_name(collecting)
          @names.push(collecting ? +"" : nil)

          nil
        end

        #: (untyped) -> void
        def append_name(value)
          frame = @names.last
          frame << value.to_s if frame

          nil
        end

        #: () -> String?
        def close_name
          return nil if @names.empty?

          rendered = @names.pop
          parent = @names.last

          parent << rendered if parent && rendered

          rendered
        end

        #: (Array[untyped]) -> bool
        def reported?(key)
          @reported.key?(key)
        end

        #: (Array[untyped]) -> void
        def record_reported(key)
          @reported[key] = true

          nil
        end

        #: (Violation) -> void
        def record(violation)
          @violations << violation

          nil
        end

        #: (Integer?) -> bool
        def full?(limit)
          !limit.nil? && @violations.length >= limit
        end
      end
    end
  end
end
