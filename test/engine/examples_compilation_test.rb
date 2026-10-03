# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"

module Engine
  class ExamplesCompilationTest < Minitest::Spec
    include SnapshotUtils

    EXAMPLE_PARSER_OPTIONS = {
      "graphql" => { erb_openers: ["graphql"] },
    }.freeze

    examples_dir = File.expand_path("../../examples", __dir__)
    example_files = Dir.glob(File.join(examples_dir, "*.html.erb"))

    example_files.each do |file_path|
      next if file_path.end_with?(".invalid.html.erb")

      basename = File.basename(file_path, ".html.erb")
      test_name = "#{basename.tr("-_", " ")} compilation"

      test test_name do
        template = File.read(file_path)
        options = { escape: false }
        parser_options = EXAMPLE_PARSER_OPTIONS[basename]
        options[:parser_options] = parser_options if parser_options

        assert_compiled_snapshot(template, options)
      end
    end
  end
end
