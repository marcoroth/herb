# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Runtime
      # What a producer observed, made fit to be written down.
      #
      # An observation is any object its producer chose to record, while both places it ends up are
      # JSON: the journal on disk and the report a page carries. Anything that is not already a
      # primitive has to become one, and there is a size past which an observation stops being worth
      # keeping whole.
      #
      #     Observations.jsonable({ queries: [statement, connection] })
      #     #=> { "queries" => ["SELECT 1", "#<ActiveRecord::ConnectionAdapters::SQLite3Adapter>"] }
      #
      # The default `to_s` of an object carries its memory address, which means nothing once the
      # process is gone and differs on every run, so what is kept is the class name alone. It says
      # an object was there without pretending to be it.
      #
      module Observations
        MAX_SAMPLED = 12 #: Integer
        MAX_LENGTH = 240 #: Integer

        class << self
          #: (untyped) -> untyped
          def jsonable(value)
            case value
            when nil, true, false, String, Integer then value
            when Float then value.finite? ? value : value.to_s
            when Symbol then value.to_s
            when Array then value.map { |entry| jsonable(entry) }
            when Hash then jsonable_hash(value)
            else "#<#{value.class.name || "Object"}>"
            end
          rescue StandardError
            nil
          end

          #: (untyped, ?sampled: Integer, ?length: Integer) -> Hash[untyped, untyped]
          def trim(data, sampled: MAX_SAMPLED, length: MAX_LENGTH)
            return {} unless data.is_a?(Hash)

            data.transform_values do |value|
              next truncate(value, length) unless value.is_a?(Array)

              value.first(sampled).map { |observed| truncate(observed, length) }
            end
          end

          #: (untyped, ?Integer) -> untyped
          def truncate(observed, length = MAX_LENGTH)
            return observed unless observed.is_a?(String)
            return observed if observed.length <= length

            "#{observed[0, length]}…"
          end

          private

          #: (Hash[untyped, untyped]) -> Hash[String, untyped]
          def jsonable_hash(value)
            sanitized = {} #: Hash[String, untyped]

            value.each { |key, entry| sanitized[key.to_s] = jsonable(entry) }

            sanitized
          end
        end
      end
    end
  end
end
