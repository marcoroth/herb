# frozen_string_literal: true

module Herb
  module Rubocop
    class SourceMapper
      def initialize(source, project_root)
        @source = source
        @project_root = File.expand_path(project_root)
      end

      def location(begin_pos, end_pos)
        Herb::Location.new(position(begin_pos), position(end_pos))
      end

      def canonical_filename(filename)
        expanded_filename = File.expand_path(filename)
        canonical_root = File.realpath(@project_root)
        return expanded_filename unless within_project?(expanded_filename)

        expanded_filename.sub(/\A#{Regexp.escape(@project_root)}/, canonical_root)
      rescue Errno::ENOENT
        expanded_filename
      end

      private

      def within_project?(filename)
        filename == @project_root || filename.start_with?("#{@project_root}/")
      end

      def position(offset)
        prefix = @source.byteslice(0, offset) || ""
        line = prefix.count("\n") + 1
        last_newline = prefix.rindex("\n")
        line_source = last_newline ? prefix.byteslice((last_newline + 1)..) : prefix
        column = line_source.force_encoding(Encoding::UTF_8).length

        Herb::Position.new(line, column)
      end
    end
  end
end
