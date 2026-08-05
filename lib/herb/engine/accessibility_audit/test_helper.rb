# frozen_string_literal: true
# typed: false

require_relative "../accessibility_audit"

module Herb
  class Engine
    module AccessibilityAudit
      # Turns render-time accessibility violations into test failures.
      #
      # Include it in a test case to audit every render that happens in it:
      #
      #     class ActiveSupport::TestCase
      #       include Herb::Engine::AccessibilityAudit::TestHelper
      #     end
      #
      # Each test runs inside its own audit session, so `duplicate-id` sees a whole rendered
      # document and violations from one test never leak into the next. A test that records a
      # violation fails, unless it opted out with `skip_accessibility_audit!`.
      #
      # For a narrower scope, assert on a single render instead:
      #
      #     assert_no_accessibility_violations { render "users/show" }
      #
      # Frameworks without `setup`/`teardown` hooks can reach for the same primitives directly:
      # `AccessibilityAudit.start_session`, `AccessibilityAudit.verify!`, and
      # `AccessibilityAudit.end_session`.
      module TestHelper
        #: () -> void
        def before_setup
          super

          @accessibility_audit_skipped = false

          AccessibilityAudit.start_session
        end

        #: () -> void
        def after_teardown
          violations = AccessibilityAudit.end_session

          super

          return if @accessibility_audit_skipped
          return if violations.empty?
          return unless accessibility_audit_reportable?

          fail_with_accessibility_violations(violations)
        end

        #: () -> void
        def skip_accessibility_audit!
          @accessibility_audit_skipped = true

          nil
        end

        #: () { () -> void } -> Array[Violation]
        def assert_no_accessibility_violations(&)
          violations = AccessibilityAudit.collect(&)

          if violations.empty?
            assert_accessibility_audit_passed
          else
            fail_with_accessibility_violations(violations)
          end

          violations
        end

        #: () { () -> void } -> Array[Violation]
        def accessibility_violations(&)
          AccessibilityAudit.collect(&)
        end

        private

        #: () -> bool
        def accessibility_audit_reportable?
          return true unless respond_to?(:failures)

          failures.empty?
        end

        #: (Array[Violation]) -> void
        def fail_with_accessibility_violations(violations)
          message = AccessibilityAudit.format_violations(violations)

          raise ViolationError, message unless respond_to?(:flunk)

          flunk(message)
        end

        #: () -> void
        def assert_accessibility_audit_passed
          assert(true) if respond_to?(:assert)

          nil
        end
      end
    end
  end
end
