# frozen_string_literal: true
# typed: true

module Herb
  class Engine
    module Runtime
      class Journal
        # What a journal says once its records are folded together.
        #
        # Read raw, a journal shows the same finding two hundred times. Folding on position turns
        # that into one finding per place, which is both what an editor can show and the only form
        # in which the history says something the requests do not.
        #
        # Everything here carries the number of times it was seen, because what this holds is
        # evidence and not proof. A rewrite proposed from it is only as good as the renders that
        # happened to run, so a reader gets counts and phrases them itself. Nothing here says
        # "always".
        #
        class Summary
          Finding = Data.define(
            :line, :column, :end_line, :end_column, :code, :origin, :kind, :severity,
            :message, :value, :peak_message, :description, :observations, :values, :range,
            :observed, :observed_trimmed, :recent, :first_seen, :last_seen, :paths, :runs
          )

          Call = Data.define(
            :line, :column, :via, :targets, :per_parent, :parents, :renders,
            :observations, :first_seen, :last_seen, :paths
          )

          class Call
            #: () -> Integer
            def peak
              per_parent.keys.max || 0
            end

            #: () -> String?
            def only_target
              return nil unless targets.size == 1

              targets.keys.first
            end
          end

          MAX_RECENT = 5 #: Integer

          attr_reader :template #: String
          attr_reader :digest #: String
          attr_reader :findings #: Array[Finding]
          attr_reader :calls #: Array[Call]
          attr_reader :dropped #: Integer
          attr_reader :first_seen #: String?

          #: (String, String, Array[Hash[String, untyped]]) -> Summary
          def self.build(template, digest, records)
            header = records.find { |record| record["t"] == "template" }

            new(
              template: template,
              digest: (header && header["digest"]) || digest,
              findings: fold_findings(records.select { |record| record["t"] == "finding" }),
              calls: fold_calls(records.select { |record| record["t"] == "call" }),
              dropped: records.select { |record| record["t"] == "truncated" }.sum { |record| record["dropped"].to_i },
              first_seen: header && header["first_seen"]
            )
          end

          #: (Array[Hash[String, untyped]]) -> Array[Finding]
          def self.fold_findings(records)
            records
              .group_by { |record| [record["line"], record["column"], record["code"] || record["message"]] }
              .map { |_, group| finding_for(group) }
              .sort_by { |finding| [finding.line.to_i, finding.column.to_i, finding.code.to_s] }
          end

          #: (Array[Hash[String, untyped]]) -> Array[Call]
          def self.fold_calls(records)
            records
              .group_by { |record| [record["line"], record["column"]] }
              .map { |_, group| call_for(group) }
              .sort_by { |call| [call.line.to_i, call.column.to_i] }
          end

          #: (Array[Hash[String, untyped]]) -> Finding
          def self.finding_for(group)
            latest = newest(group)
            peak = worst(group)
            values = group.filter_map { |record| record["value"] }
            seen = group.filter_map { |record| record["at"] }.sort

            Finding.new(
              line: latest["line"],
              column: latest["column"],
              end_line: latest["end_line"],
              end_column: latest["end_column"],
              code: latest["code"],
              origin: latest["origin"],
              kind: latest["kind"],
              severity: latest["severity"],
              message: latest["message"],
              value: latest["value"] || latest["message"],
              peak_message: peak["message"] || latest["message"],
              description: peak["description"],
              observations: peak["data"] || {},
              values: values.tally,
              range: range(values),
              observed: group.size,
              observed_trimmed: peak["data_trimmed"] == true,
              recent: recent(group),
              first_seen: seen.first,
              last_seen: seen.last,
              paths: group.filter_map { |record| record["request_path"] }.tally,
              runs: group.filter_map { |record| record["run"] }.uniq.last(MAX_RECENT)
            )
          end

          #: (Array[Hash[String, untyped]]) -> Call
          def self.call_for(group)
            latest = newest(group)
            seen = group.filter_map { |record| record["at"] }.sort

            Call.new(
              line: latest["line"],
              column: latest["column"],
              via: latest["via"],
              targets: merge_counts(group.map { |record| record["targets"] }),
              per_parent: merge_counts(group.map { |record| record["per_parent"] }).transform_keys(&:to_i),
              parents: group.sum { |record| record["parents"].to_i },
              renders: group.sum { |record| record["renders"].to_i },
              observations: group.size,
              first_seen: seen.first,
              last_seen: seen.last,
              paths: group.filter_map { |record| record["request_path"] }.tally
            )
          end

          #: (Array[Hash[String, untyped]]) -> Hash[String, untyped]
          def self.newest(group)
            group.each_with_index.max_by { |record, index| [record["at"].to_s, index] }&.first || group.last || {}
          end

          #: (Array[Hash[String, untyped]]) -> Hash[String, untyped]
          def self.worst(group)
            group.each_with_index.max_by { |record, index|
              [leading_number(record["value"]) || -Float::INFINITY, index]
            }&.first || group.last || {}
          end

          #: (Array[Hash[String, untyped]]) -> Array[Hash[Symbol, untyped]]
          def self.recent(group)
            group
              .each_with_index
              .sort_by { |record, index| [record["at"].to_s, index] }
              .reverse
              .map { |record, _| record }
              .flat_map { |record| values_in(record).reverse.map { |value| { value: value, at: record["at"] } } }
              .first(MAX_RECENT)
          end

          #: (Hash[String, untyped]) -> Array[untyped]
          def self.values_in(record)
            observed = record.dig("data", "output")

            return observed if observed.is_a?(Array) && observed.any?

            [record["value"] || record["message"]].compact
          end

          #: (Array[Hash[String, untyped]?]) -> Hash[untyped, Integer]
          def self.merge_counts(counts)
            merged = {} #: Hash[untyped, Integer]

            counts.each do |tally|
              next unless tally.is_a?(Hash)

              tally.each do |key, count|
                seen = count.to_i #: Integer

                merged[key] = (merged[key] || 0) + seen
              end
            end

            merged
          end

          #: (Array[String]) -> Hash[Symbol, untyped]?
          def self.range(values)
            return nil if values.empty?

            numbers = values.filter_map { |value| leading_number(value) }

            return nil unless numbers.size == values.size

            { min: numbers.min, max: numbers.max }
          end

          #: (untyped) -> Float?
          def self.leading_number(value)
            match = value.to_s[/\A\s*(-?\d+(?:\.\d+)?)/, 1]

            match&.to_f
          end

          #: (template: String, digest: String, findings: Array[Finding], calls: Array[Call], dropped: Integer, first_seen: String?) -> void
          def initialize(template:, digest:, findings:, calls:, dropped:, first_seen:)
            @template = template
            @digest = digest
            @findings = findings
            @calls = calls
            @dropped = dropped
            @first_seen = first_seen
          end

          #: () -> bool
          def truncated?
            dropped.positive?
          end

          #: () -> bool
          def empty?
            findings.empty? && calls.empty?
          end
        end
      end
    end
  end
end
