# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class ValidationDeduplicationTest < Minitest::Spec
    include SnapshotUtils

    around do |test|
      @fixed_time = Time.utc(2025, 1, 1, 12, 0, 0)

      Time.stub :now, @fixed_time do
        test.call
      end
    end

    test "validation errors in ERB loops generate single template per location" do
      input = "<% 10.times do |i| %><div <%= i %>></div><% end %>"

      assert_compiled_snapshot(input, validation_mode: :overlay, filename: "loop_test.html.erb")
    end

    test "multiple identical errors at different locations generate separate templates" do
      input = <<~ERB
        <div <%= @bad1 %>></div>
        <div <%= @bad1 %>></div>
        <div <%= @bad2 %>></div>
      ERB

      assert_compiled_snapshot(input, validation_mode: :overlay, filename: "multi_test.html.erb")
    end

    test "validation overlay includes deduplication metadata" do
      input = "<div <%= @test %>></div>"

      assert_compiled_snapshot(input, validation_mode: :overlay, filename: "meta_test.html.erb")
    end
  end
end
