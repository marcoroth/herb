# frozen_string_literal: true

module RuboCop
  module Herb
    # The Ruby of a template, aligned character for character with the template, plus the
    # character ranges that hold the Ruby of each ERB tag (without surrounding whitespace).
    class TemplateSource < ::RuboCop::ProcessedSource
      EXTENSIONS = [".erb", ".herb"].freeze

      def self.template?(path)
        path&.end_with?(*EXTENSIONS)
      end

      def self.from(original)
        template = original.raw_source
        code = align(template, ::Herb.extract_ruby(template))

        new(code, original.ruby_version, original.path, parser_engine: original.parser_engine).tap do |source|
          source.config = original.config
          source.registry = original.registry
          source.ruby_ranges = ruby_ranges(template, code)
        end
      end

      # `Herb.extract_ruby` preserves byte positions; RuboCop addresses characters. Collapse each
      # masked multibyte character to one space and keep every newline so lines stay aligned.
      def self.align(template, extracted)
        offset = 0

        template.each_char.map { |char|
          slice = extracted.byteslice(offset, char.bytesize)
          offset += char.bytesize

          if char == "\n" || slice == char then char
          elsif char.bytesize == 1 then slice
          else " "
          end
        }.join
      end

      # Ruby characters are the non-whitespace template characters that survive extraction. ERB
      # delimiters never survive, so they split the template into one range per tag.
      def self.ruby_ranges(template, code)
        ranges = []
        start = finish = nil

        template.each_char.zip(code.each_char).each_with_index do |(original, extracted), index|
          next if original.match?(/\s/)

          if original == extracted
            start ||= index
            finish = index + 1
          elsif start
            ranges << (start...finish)
            start = nil
          end
        end

        ranges << (start...finish) if start
        ranges
      end

      attr_accessor :ruby_ranges

      # Both ends of the range touch Ruby, so the offense points at code rather than at markup.
      def anchored_in_ruby?(range)
        touches_ruby?(range.begin_pos) && touches_ruby?(range.end_pos)
      end

      # The range lies within the Ruby of a single tag, so editing it cannot alter markup.
      def within_ruby?(range)
        ruby_ranges.any? { |ruby| ruby.begin <= range.begin_pos && range.end_pos <= ruby.end }
      end

      private

      def touches_ruby?(position)
        ruby_ranges.any? { |ruby| position.between?(ruby.begin, ruby.end) }
      end
    end
  end
end
