# frozen_string_literal: true

module Herb
  module Rubocop
    class Inspector
      def initialize(configuration, rubocop_config)
        @configuration = configuration
        @rubocop_config = rubocop_config
      end

      def inspect(fragment, filename, source_mapper, autocorrect:, autocorrect_all:)
        return [[], []] if fragment.ruby_source.strip.empty?

        processed_source = processed_source(fragment, filename)
        return [[], []] unless processed_source.valid_syntax?

        team = build_team(autocorrect, autocorrect_all)
        report = team.investigate(processed_source)
        raise Error, team.errors.join("\n") if team.errors.any?

        [
          offenses_from(report, fragment, source_mapper),
          corrections_from(report, fragment)
        ]
      end

      private

      def processed_source(fragment, filename)
        source = ::RuboCop::ProcessedSource.new(
          fragment.aligned_source,
          @rubocop_config.target_ruby_version,
          filename
        )
        source.registry = ::RuboCop::Cop::Registry.global
        source.config = @rubocop_config
        source
      end

      def build_team(autocorrect, autocorrect_all)
        options = {
          autocorrect: autocorrect,
          auto_correct: autocorrect,
          safe_autocorrect: autocorrect && !autocorrect_all,
          stdin: "",
        }

        ::RuboCop::Cop::Team.mobilize(cop_classes, @rubocop_config, options)
      end

      def cop_classes
        all_cops = ::RuboCop::Cop::Registry.all
        return ::RuboCop::Cop::Registry.new(all_cops) unless @configuration.only&.any?

        selected = all_cops.each_with_object([]) do |cop, matches|
          matches << cop if cop.match?(@configuration.only)
        end
        ::RuboCop::Cop::Registry.new(selected)
      end

      def offenses_from(report, fragment, source_mapper)
        report.offenses.filter_map do |rubocop_offense|
          next if rubocop_offense.disabled?

          offense_from(rubocop_offense, fragment, source_mapper)
        end
      end

      def offense_from(rubocop_offense, fragment, source_mapper)
        begin_pos = fragment.offset + rubocop_offense.location.begin_pos
        end_pos = fragment.offset + rubocop_offense.location.end_pos

        Offense.new(
          cop_name: rubocop_offense.cop_name,
          message: offense_message(rubocop_offense),
          severity: rubocop_offense.severity.name,
          location: source_mapper.location(begin_pos, end_pos),
          correctable: rubocop_offense.correctable?
        )
      end

      def offense_message(offense)
        offense.message.sub(/\A#{Regexp.escape(offense.cop_name)}:\s*/, "").strip
      end

      def corrections_from(report, fragment)
        report.offenses.flat_map do |rubocop_offense|
          next [] unless rubocop_offense.corrected? && rubocop_offense.corrector

          corrections_for_offense(rubocop_offense, fragment)
        end
      end

      def corrections_for_offense(offense, fragment)
        replacements = offense.corrector.as_replacements
        return [] unless replacements.all? { |range, _replacement|
          fragment.contains?(fragment.offset + range.begin_pos, fragment.offset + range.end_pos)
        }

        replacements.map { |range, replacement| correction_from(fragment, range, replacement) }
      end

      def correction_from(fragment, range, replacement)
        begin_pos = fragment.offset + range.begin_pos
        end_pos = fragment.offset + range.end_pos

        Correction.new(begin_pos: begin_pos, end_pos: end_pos, replacement: replacement)
      end
    end
  end
end
