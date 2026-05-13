# frozen_string_literal: true
# typed: true

module Herb
  class Diagnostic
    attr_reader :message #: String
    attr_reader :location #: Location
    attr_reader :severity #: String
    attr_reader :code #: String?
    attr_reader :source #: String?

    #: (String, Location, String, ?code: String?, ?source: String?) -> void
    def initialize(message, location, severity, code: nil, source: nil)
      @message = message
      @location = location
      @severity = severity
      @code = code
      @source = source
    end

    #: () -> bool
    def error? = severity == "error"

    #: () -> bool
    def warning? = severity == "warning"

    #: () -> bool
    def info? = severity == "info"

    #: () -> bool
    def hint? = severity == "hint"

    #: () -> Hash[Symbol, untyped]
    def to_hash
      hash = {
        message: message,
        location: location.to_hash,
        severity: severity
      }

      hash[:code] = code if code
      hash[:source] = source if source
      hash
    end

    #: (?untyped) -> String
    def to_json(state = nil)
      to_hash.to_json(state)
    end

    #: () -> String
    def inspect
      %(#<Herb::Diagnostic severity=#{severity.inspect} message=#{message.inspect}>)
    end
  end
end
