# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class ValidationDeduplicationTest < Minitest::Spec
    test "validation errors in ERB loops generate single template per location" do
      input = "<% 10.times do |i| %><div <%= i %>></div><% end %>"

      engine = Herb::Engine.new(input, validation_mode: :overlay, filename: "loop_test.html.erb")

      templates = engine.src.scan(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)

      assert_equal 1, templates.length, "ERB loops should generate one validation error per unique location"

      template = templates.first

      assert_includes template, 'data-source="SecurityValidator"'
      assert_includes template, 'data-line="1"'
      assert_includes template, 'data-column="26"'
      assert_includes template, "ERB output tags"
    end

    test "multiple identical errors at different locations generate separate templates" do
      input = <<~ERB
        <div <%= @bad1 %>></div>
        <div <%= @bad1 %>></div>
        <div <%= @bad2 %>></div>
      ERB

      engine = Herb::Engine.new(input, validation_mode: :overlay, filename: "multi_test.html.erb")

      templates = engine.src.scan(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)

      assert_equal 3, templates.length, "Each unique location should generate its own template"

      line_numbers = templates.map do |template|
        template.match(/data-line="(\d+)"/)[1].to_i
      end

      assert_equal [1, 2, 3], line_numbers.sort
    end

    test "validation overlay includes deduplication metadata" do
      input = "<div <%= @test %>></div>"

      engine = Herb::Engine.new(input, validation_mode: :overlay, filename: "meta_test.html.erb")

      template_match = engine.src.match(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)
      assert template_match, "Should contain validation error template"

      template = template_match[0]

      assert_includes template, "data-herb-validation-error"
      assert_includes template, 'data-severity="error"'
      assert_includes template, 'data-source="SecurityValidator"'
      assert_includes template, 'data-code="SecurityViolation"'
      assert_includes template, 'data-line="1"'
      assert_includes template, 'data-column="5"'
      assert_includes template, 'data-filename="meta_test.html.erb"'
      assert_includes template, "data-message="
      assert_includes template, "data-suggestion="
      assert_includes template, "data-timestamp="
      assert_includes template, "herb-validation-item"
      assert_includes template, "herb-validation-badge"
      assert_includes template, "herb-code-snippet"
    end
  end
end
