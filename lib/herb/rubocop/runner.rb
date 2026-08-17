# frozen_string_literal: true

module Herb
  module Rubocop
    class Runner
      MAX_AUTOCORRECT_PASSES = 200

      def initialize(configuration)
        @configuration = configuration
        @inspector = Inspector.new(configuration, configuration.load)
      end

      def inspect_file(filename, autocorrect: false, autocorrect_all: false)
        source = File.binread(filename).force_encoding(Encoding::UTF_8)

        if autocorrect
          corrected_source = autocorrect_source(source, filename, autocorrect_all)
          File.binwrite(filename, corrected_source) unless corrected_source == source
          source = corrected_source
        end

        offenses, = inspect_source(source, filename)
        Result.new(filename: filename, offenses: offenses)
      end

      def inspect_source(source, filename, autocorrect: false, autocorrect_all: false)
        offenses = []
        corrections = []
        source_mapper = SourceMapper.new(source, @configuration.project_root)
        filename = source_mapper.canonical_filename(filename)

        FragmentExtractor.extract(source).each do |fragment|
          fragment_offenses, fragment_corrections = @inspector.inspect(
            fragment,
            filename,
            source_mapper,
            autocorrect: autocorrect,
            autocorrect_all: autocorrect_all
          )
          offenses.concat(fragment_offenses)
          corrections.concat(fragment_corrections)
        end

        [offenses, corrections]
      end

      private

      def autocorrect_source(source, filename, autocorrect_all)
        MAX_AUTOCORRECT_PASSES.times do
          _offenses, corrections = inspect_source(
            source,
            filename,
            autocorrect: true,
            autocorrect_all: autocorrect_all
          )
          return source if corrections.empty?

          corrected_source = apply_corrections(source, corrections)
          raise Error, "RuboCop autocorrection did not change the template" if corrected_source == source

          source = corrected_source
        end

        raise Error, "RuboCop autocorrection did not converge after #{MAX_AUTOCORRECT_PASSES} passes"
      end

      def apply_corrections(source, corrections)
        unique_corrections = corrections.uniq { |correction|
          [correction.begin_pos, correction.end_pos, correction.replacement]
        }
        ensure_non_overlapping!(unique_corrections)

        unique_corrections.sort_by(&:begin_pos).reverse_each do |correction|
          source = source.byteslice(0, correction.begin_pos) +
                   correction.replacement +
                   source.byteslice(correction.end_pos..)
        end

        source
      end

      def ensure_non_overlapping!(corrections)
        sorted_corrections = corrections.sort_by { |correction| [correction.begin_pos, correction.end_pos] }

        sorted_corrections.each_cons(2) do |left, right|
          next if left.end_pos <= right.begin_pos

          raise Error, "RuboCop produced overlapping autocorrections"
        end
      end
    end
  end
end
