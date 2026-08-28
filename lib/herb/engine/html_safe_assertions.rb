# frozen_string_literal: true
# typed: false

module Herb
  class Engine
    # Runtime counterpart of `Herb::Engine::Visitors::HTMLSafeAssertions`.
    #
    # `check` inspects the value a template is about to mark as HTML-safe and reports it when
    # the value contains HTML that the browser executes, such as a `<script>` element, an
    # inline event handler, or a `javascript:` URL. It returns the value unchanged, so it can
    # wrap any expression.
    #
    # Values that are already HTML-safe are left alone, since `.html_safe` is a no-op on them.
    #
    # The checks are heuristics over the string. They catch the payloads that reach templates
    # through unescaped user input, not every possible way to write HTML that executes.
    #
    module HTMLSafeAssertions
      MODES = [:raise, :warn].freeze

      MAX_VALUE_LENGTH = 200

      EVENT_HANDLER_NAMES = [
        "abort", "animationcancel", "animationend", "animationiteration", "animationstart",
        "auxclick", "beforeinput", "beforematch", "beforeprint", "beforetoggle", "beforeunload",
        "blur", "cancel", "canplay", "canplaythrough", "change", "click", "close", "command",
        "contextmenu", "copy", "cuechange", "cut", "dblclick", "drag", "dragend", "dragenter",
        "dragleave", "dragover", "dragstart", "drop", "durationchange", "emptied", "ended",
        "error", "focus", "focusin", "focusout", "formdata", "fullscreenchange",
        "fullscreenerror", "gotpointercapture", "hashchange", "input", "invalid", "keydown",
        "keypress", "keyup", "load", "loadeddata", "loadedmetadata", "loadstart",
        "lostpointercapture", "message", "messageerror", "mousedown", "mouseenter", "mouseleave",
        "mousemove", "mouseout", "mouseover", "mouseup", "offline", "online", "pagehide",
        "pageshow", "paste", "pause", "play", "playing", "pointercancel", "pointerdown",
        "pointerenter", "pointerleave", "pointermove", "pointerout", "pointerover",
        "pointerrawupdate", "pointerup", "popstate", "progress", "ratechange", "reset", "resize",
        "scroll", "scrollend", "search", "securitypolicyviolation", "seeked", "seeking", "select",
        "selectionchange", "selectstart", "show", "slotchange", "stalled", "storage", "submit",
        "suspend", "timeupdate", "toggle", "touchcancel", "touchend", "touchmove", "touchstart",
        "transitioncancel", "transitionend", "transitionrun", "transitionstart",
        "unhandledrejection", "unload", "volumechange", "waiting", "wheel"
      ].freeze

      EVENT_HANDLER_PATTERN = %r{<[a-z][^<>]*?[\s/](on(?:#{EVENT_HANDLER_NAMES.join("|")}))\s*=}im

      class Violation
        attr_reader :name #: Symbol
        attr_reader :message #: String
        attr_reader :snippet #: String

        #: (Symbol, String, String) -> void
        def initialize(name, message, snippet)
          @name = name
          @message = message
          @snippet = snippet
        end

        #: () -> String
        def inspect
          "#<#{self.class.name} name=#{@name.inspect} snippet=#{@snippet.inspect}>"
        end
      end

      class Check
        attr_reader :name #: Symbol
        attr_reader :requires #: Symbol
        attr_reader :pattern #: Regexp
        attr_reader :message #: String

        #: (Symbol, Symbol, Regexp, String) -> void
        def initialize(name, requires, pattern, message)
          @name = name
          @requires = requires
          @pattern = pattern
          @message = message
        end

        #: (String) -> Violation?
        def violation_for(string)
          return nil unless @pattern.match?(string)

          match = @pattern.match(string)

          return nil unless match

          Violation.new(@name, message_for(match), match[0].to_s)
        end

        private

        #: (MatchData) -> String
        def message_for(match)
          return @message unless @message.include?("%s")

          format(@message, (match[1] || match[0]).to_s.downcase)
        end
      end

      CHECKS = [
        Check.new(:script_element, :markup, /<script\b/i, "a `<script>` element, which the browser executes"),
        Check.new(:event_handler, :markup, EVENT_HANDLER_PATTERN, "an inline `%s` event handler, which the browser executes"),
        Check.new(:javascript_url, :scheme, /(?:\A|=|["'])\s*(javascript|vbscript)\s*:/i, "a `%s:` URL, which the browser executes"),
        Check.new(:data_url, :scheme, %r{(?:\A|=|["'])\s*data\s*:\s*text/html}i, "a `data:text/html` URL, which the browser renders as its own document"),
        Check.new(:risky_element, :markup, /<(iframe|object|embed|base|portal)\b/i, "an `<%s>` element, which can load and run remote content"),
        Check.new(:meta_refresh, :markup, /<meta\b[^<>]*http-equiv\s*=\s*(?:["']\s*)?refresh/i, "a `<meta http-equiv=\"refresh\">` element, which redirects the page")
      ].freeze

      CHECK_NAMES = CHECKS.map(&:name).freeze

      class UnsafeHTMLError < StandardError
        attr_reader :value #: untyped
        attr_reader :violations #: Array[Violation]
        attr_reader :file #: String?
        attr_reader :line #: Integer?
        attr_reader :column #: Integer?
        attr_reader :source #: String?

        #: (value: untyped, violations: Array[Violation], ?file: String?, ?line: Integer?, ?column: Integer?, ?source: String?) -> void
        def initialize(value:, violations:, file: nil, line: nil, column: nil, source: nil) # rubocop:disable Metrics/ParameterLists
          @value = value
          @violations = violations
          @file = file
          @line = line
          @column = column
          @source = source

          super(build_message)
        end

        private

        #: () -> String
        def build_message
          parts = ["Unsafe `.html_safe` call#{location_suffix}"] #: Array[String]
          source = @source

          parts << indent(source) if source
          parts << @violations.map { |violation| "The value contains #{violation.message}." }.join("\n")
          parts << indent(truncate(@value.inspect))
          parts << "Escape the value or run it through `sanitize` instead of marking it as HTML-safe."

          parts.join("\n\n")
        end

        #: () -> String
        def location_suffix
          location = [@file, @line, @column].compact.join(":")

          location.empty? ? "" : " in #{location}"
        end

        #: (String) -> String
        def indent(string)
          string.each_line.map { |line| "    #{line}" }.join
        end

        #: (String) -> String
        def truncate(string)
          string.length > MAX_VALUE_LENGTH ? "#{string[0, MAX_VALUE_LENGTH]}..." : string
        end
      end

      # @rbs!
      #   def self.on_violation: () -> (^(UnsafeHTMLError) -> void)?
      #   def self.on_violation=: ((^(UnsafeHTMLError) -> void)?) -> (^(UnsafeHTMLError) -> void)?

      class << self
        attr_accessor :on_violation #: (^(UnsafeHTMLError) -> void)?
      end

      self.on_violation = nil

      #: (untyped, ?file: String?, ?line: Integer?, ?column: Integer?, ?source: String?, ?mode: Symbol, ?ignore: Array[Symbol]) -> untyped
      def self.check(value, file: nil, line: nil, column: nil, source: nil, mode: :raise, ignore: []) # rubocop:disable Metrics/ParameterLists
        violations = violations_for(value, ignore: ignore)

        return value if violations.empty?

        error = UnsafeHTMLError.new(
          value: value,
          violations: violations,
          file: file,
          line: line,
          column: column,
          source: source
        )

        handler = on_violation

        if handler
          handler.call(error)
        elsif mode == :warn
          warn(error.message)
        else
          raise error
        end

        value
      end

      #: (untyped, ?ignore: Array[Symbol]) -> Array[Violation]
      def self.violations_for(value, ignore: [])
        return [] unless value.is_a?(::String)
        return [] if value.respond_to?(:html_safe?) && value.html_safe?

        markup = value.include?("<")
        scheme = value.include?(":")

        return [] unless markup || scheme

        ignored = ignore.empty? ? ignore : ignore.map(&:to_sym)
        violations = [] #: Array[Violation]

        CHECKS.each do |check|
          next unless check.requires == :markup ? markup : scheme
          next if ignored.include?(check.name)

          violation = check.violation_for(value)

          violations << violation if violation
        end

        violations
      end
    end
  end
end
