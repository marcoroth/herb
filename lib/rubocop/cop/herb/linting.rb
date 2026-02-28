# frozen_string_literal: true

module RuboCop
  module Cop
    module Herb
      # Runs the Herb linter on ERB/HTML template files and reports offenses
      # as RuboCop findings.
      #
      # Individual Herb rules are configured via `.herb.yml`, not `.rubocop.yml`.
      # This cop acts as a bridge, running all enabled Herb rules in a single
      # pass and mapping the results into RuboCop's offense system.
      #
      # @example
      #   # .rubocop.yml
      #   Herb/Linting:
      #     Enabled: true
      #
      class Linting < Base
        TEMPLATE_EXTENSIONS = %w[.erb .html .htm].freeze

        SEVERITY_MAP = {
          "error" => :error,
          "warning" => :warning,
          "info" => :convention,
          "hint" => :refactor,
        }.freeze

        def on_new_investigation
          investigate_herb
        end

        def on_other_file
          investigate_herb
        end

        private

        def investigate_herb
          return unless template_file?
          return unless herb_linter_available?

          source = processed_source.raw_source
          path = processed_source.file_path

          return if source.empty?

          result = ::Herb.lint(source, file_name: path)
          return if result.nil?

          result.offenses.each do |offense|
            range = build_range(offense)
            severity = map_severity(offense.severity)

            add_offense(range, message: offense_message(offense), severity: severity)
          end
        end

        def template_file?
          path = processed_source.file_path
          return false unless path

          TEMPLATE_EXTENSIONS.any? { |ext| path.end_with?(ext) }
        end

        def herb_linter_available?
          ::Herb::Linter.available?
        end

        def build_range(offense)
          buffer = processed_source.buffer

          start_line = offense.location.start.line
          start_column = offense.location.start.column
          end_line = offense.location.end.line
          end_column = offense.location.end.column

          begin_position = buffer.line_range(start_line).begin_pos + start_column
          end_position = buffer.line_range(end_line).begin_pos + end_column

          Parser::Source::Range.new(buffer, begin_position, end_position)
        end

        def map_severity(herb_severity)
          SEVERITY_MAP.fetch(herb_severity, :convention)
        end

        def offense_message(offense)
          "[#{offense.rule}] #{offense.message}"
        end
      end
    end
  end
end
