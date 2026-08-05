# frozen_string_literal: true
# typed: false

require_relative "accessibility_audit/violation_error"
require_relative "accessibility_audit/violation"
require_relative "accessibility_audit/text"
require_relative "accessibility_audit/checks"
require_relative "accessibility_audit/attribute_check"
require_relative "accessibility_audit/content_check"
require_relative "accessibility_audit/session"
require_relative "accessibility_audit/middleware"

module Herb
  class Engine
    # Render-time accessibility audit runtime.
    #
    # `Herb::Engine::AccessibilityAudit::Visitor` rewrites the template AST so that dynamic values
    # flow through the methods in this module while the template renders. Every entry point is
    # identity-preserving: `attribute` and `name_part` return the exact object they were given,
    # so auditing a template never changes what it renders.
    #
    # This complements the static `AccessibilityValidator` and the linter rules: those can only
    # reason about literal markup, while these checks see the values ERB actually produced.
    module AccessibilityAudit
      autoload :Visitor, "herb/engine/accessibility_audit/visitor"

      STATE_KEY = :herb_accessibility_audit_session

      # @rbs!
      #   def self.mode=: (Symbol) -> Symbol
      #   def self.logger: () -> untyped
      #   def self.logger=: (untyped) -> untyped
      #   def self.on_violation: () -> (^(Violation) -> void)?
      #   def self.on_violation=: ((^(Violation) -> void)?) -> (^(Violation) -> void)?
      #   def self.disabled_checks=: (Array[Symbol]) -> Array[Symbol]
      #   def self.sample_rate=: (Float) -> Float
      #   def self.report_once=: (bool) -> bool
      #   def self.max_violations: () -> Integer?
      #   def self.max_violations=: (Integer?) -> Integer?

      class << self
        attr_writer :mode #: Symbol
        attr_accessor :logger #: untyped
        attr_accessor :on_violation #: (^(Violation) -> void)?
        attr_writer :disabled_checks #: Array[Symbol]
        attr_writer :sample_rate #: Float
        attr_writer :report_once #: bool
        attr_accessor :max_violations #: Integer?

        #: () { (untyped) -> void } -> void
        def configure
          yield self

          nil
        end

        #: () -> Symbol
        def mode
          @mode ||= :warn
        end

        #: () -> Array[Symbol]
        def disabled_checks
          @disabled_checks ||= []
        end

        #: () -> Float
        def sample_rate
          @sample_rate ||= 1.0
        end

        #: () -> bool
        def report_once
          @report_once ||= false
        end

        #: () -> bool
        def enabled?
          return false if mode == :disabled

          current.sampled?
        end

        #: (Symbol) -> bool
        def check_enabled?(check)
          !disabled_checks.include?(check)
        end

        #: (String, String) -> Array[Symbol]
        def attribute_checks(element, attribute)
          Checks.for_attribute(element, attribute).select { |check| check_enabled?(check) }
        end

        #: (String) -> Array[Symbol]
        def content_checks(element)
          Checks.for_content(element).select { |check| check_enabled?(check) }
        end

        #: (untyped, element: String, attribute: String, ?file: String?, ?line: Integer?, ?column: Integer?) -> untyped
        def attribute(value, element:, attribute:, file: nil, line: nil, column: nil)
          return value unless enabled?

          rendered = value&.to_s
          ids = current.ids

          attribute_checks(element, attribute).each do |check|
            message = AttributeCheck.violation(check, rendered, element, attribute, ids: ids)
            next unless message

            report(check, message, element: element, attribute: attribute, value: rendered, file: file, line: line,
                                   column: column)
          end

          value
        rescue ViolationError
          raise
        rescue StandardError => e
          report_internal_error(e)

          value
        end

        #: () -> nil
        def push_name
          current.open_name(enabled?)

          nil
        end

        #: (untyped) -> untyped
        def name_part(value)
          current.append_name(value)

          value
        rescue StandardError => e
          report_internal_error(e)

          value
        end

        #: (element: String, ?file: String?, ?line: Integer?, ?column: Integer?) -> nil
        def pop_name(element:, file: nil, line: nil, column: nil)
          rendered = current.close_name

          return nil unless rendered
          return nil unless enabled?

          text = Text.visible(rendered)

          content_checks(element).each do |check|
            message = ContentCheck.violation(check, text, element)
            next unless message

            report(check, message, element: element, attribute: nil, value: text, file: file, line: line, column: column)
          end

          nil
        rescue ViolationError
          raise
        rescue StandardError => e
          report_internal_error(e)

          nil
        end

        #: [T] () { () -> T } -> T
        def session
          previous = Thread.current[STATE_KEY]
          Thread.current[STATE_KEY] = new_session

          yield
        ensure
          Thread.current[STATE_KEY] = previous
        end

        #: () { () -> void } -> Array[Violation]
        def collect
          previous = Thread.current[STATE_KEY]
          Thread.current[STATE_KEY] = new_session

          yield

          violations.dup
        ensure
          Thread.current[STATE_KEY] = previous
        end

        #: () -> void
        def start_session
          Thread.current[STATE_KEY] = new_session

          nil
        end

        #: () -> Array[Violation]
        def end_session
          recorded = violations
          Thread.current[STATE_KEY] = nil

          recorded
        end

        #: () -> void
        def verify!
          recorded = violations

          return if recorded.empty?

          raise ViolationError, format_violations(recorded)
        end

        #: (Array[Violation]) -> String
        def format_violations(violations)
          heading = if violations.length == 1
                      "1 accessibility violation:"
                    else
                      "#{violations.length} accessibility violations:"
                    end

          [heading, *violations.map { |violation| "  #{violation}" }].join("\n")
        end

        #: () -> Array[Violation]
        def violations
          current.violations
        end

        #: () -> Session
        def current
          Thread.current[STATE_KEY] ||= Session.new
        end

        #: () -> void
        def reset!
          Thread.current[STATE_KEY] = Session.new
        end

        #: () -> void
        def reset_reported!
          reported_mutex.synchronize { reported_sites.clear }

          nil
        end

        private

        #: () -> Session
        def new_session
          Session.new(scoped: true, sampled: sampled?)
        end

        #: () -> bool
        def sampled?
          rate = sample_rate

          return true if rate >= 1.0
          return false if rate <= 0.0

          Random.rand < rate
        end

        #: (Symbol, String, element: String, attribute: String?, value: String?, file: String?, line: Integer?, column: Integer?) -> Violation?
        def report(check, message, element:, attribute:, value:, file:, line:, column:)
          key = [check, file, line, column]
          session = current

          return if session.reported?(key)
          return if session.full?(max_violations)

          session.record_reported(key)

          return if report_once && already_reported?(key)

          violation = Violation.new(
            check: check,
            message: message,
            element: element,
            attribute: attribute,
            value: value,
            file: file,
            line: line,
            column: column
          )

          session.record(violation)

          on_violation&.call(violation)

          case mode
          when :raise
            raise ViolationError, violation.to_s
          when :warn
            log("[Herb] #{violation}")
          end

          violation
        end

        #: (Array[untyped]) -> bool
        def already_reported?(key)
          reported_mutex.synchronize do
            next true if reported_sites.key?(key)

            reported_sites[key] = true

            false
          end
        end

        #: () -> Hash[Array[untyped], bool]
        def reported_sites
          @reported_sites ||= {}
        end

        #: () -> Thread::Mutex
        def reported_mutex
          @reported_mutex ||= Thread::Mutex.new
        end

        #: (StandardError) -> void
        def report_internal_error(error)
          return if mode == :disabled

          key = [:internal_error, error.class.name, error.message]

          return if already_reported?(key)

          log("[Herb] accessibility audit check failed: #{error.class}: #{error.message}")

          nil
        end

        #: (String) -> void
        def log(message)
          if logger
            logger.warn(message)
          else
            warn(message)
          end

          nil
        end
      end
    end
  end
end
