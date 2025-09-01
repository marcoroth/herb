# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"

module Engine
  class ExamplesCompilationTest < Minitest::Spec
    include SnapshotUtils

    examples_dir = File.expand_path("../../examples", __dir__)
    example_files = Dir.glob(File.join(examples_dir, "*.html.erb"))

    example_files.each do |file_path|
      basename = File.basename(file_path, ".html.erb")
      test_name = "#{basename.tr("-_", " ")} compilation"

      test test_name do
        template = File.read(file_path)
        assert_compiled_snapshot(template, escape: false)
      end
    end
  end
end
