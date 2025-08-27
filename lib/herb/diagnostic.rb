# frozen_string_literal: true
# typed: true

# rbs_inline: enabled

module Herb
  DIAGNOSTIC_SEVERITIES = %w[error warning info hint].freeze #: Array[String]

  class Diagnostic
    attr_reader :message #: String
    attr_reader :location #: Location?
    attr_reader :severity #: String
    attr_reader :code #: String?
    attr_reader :source #: String?

    #: (message: String, location: Location?, severity: String, ?code: String?, ?source: String?) -> void
    def initialize(message:, location:, severity:, code: nil, source: nil)
      @message = message
      @location = location
      @severity = validate_severity(severity)
      @code = code
      @source = source
    end

    #: () -> Hash[Symbol, untyped]
    def to_h
      {
        message: @message,
        location: @location.to_h,
        severity: @severity,
        code: @code,
        source: @source,
      }.compact
    end

    #: (*untyped) -> String
    def to_json(state = nil)
      to_h.to_json(state)
    end

    #: () -> String
    def to_s
      parts = [] #: Array[String]
      parts << "[#{@severity.upcase}]" if @severity
      parts << "[#{@code}]" if @code
      parts << @message
      parts << "at #{@location}" if @location
      parts.join(" ")
    end

    #: () -> bool
    def error?
      @severity == "error"
    end

    #: () -> bool
    def warning?
      @severity == "warning"
    end

    #: () -> bool
    def info?
      @severity == "info"
    end

    #: () -> bool
    def hint?
      @severity == "hint"
    end

    private

    #: (String) -> String
    def validate_severity(severity)
      unless DIAGNOSTIC_SEVERITIES.include?(severity)
        raise ArgumentError, "Invalid severity '#{severity}'. Must be one of: #{DIAGNOSTIC_SEVERITIES.join(", ")}"
      end

      severity
    end
  end
end
