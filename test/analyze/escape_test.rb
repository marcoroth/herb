# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class EscapeTest < Minitest::Spec
    include SnapshotUtils

    test "escaped erb tag" do
      assert_parsed_snapshot("<%% 'Test' %%>")
    end

    test "escaped erb output tag" do
      assert_parsed_snapshot("<%%= 'Test' %%>")
    end
  end
end
