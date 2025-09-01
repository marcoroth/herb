# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class ValidationModesTest < Minitest::Spec
    def setup
      @valid_template = "<div>Valid template</div>"
      @invalid_security_template = "<div <%= @malicious %>>Content</div>"
      @invalid_nesting_template = "<p><div>Invalid nesting</div></p>"
    end

    test ":raise mode raises SecurityError for security violations" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, validation_mode: :raise)
      end

      assert_includes error.message, "ERB output tags"
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test ":raise mode raises CompilationError for other validation errors" do
      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(@invalid_nesting_template, validation_mode: :raise)
      end

      assert_includes error.message, "Block element"
    end

    test ":raise mode is the default behavior" do
      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template)
      end

      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, validation_mode: :raise)
      end
    end

    test ":none mode skips all validation" do
      engine = Herb::Engine.new(@invalid_security_template, validation_mode: :none)
      assert_kind_of String, engine.src

      engine2 = Herb::Engine.new('<div data-<%= @name %>="value">Content</div>', validation_mode: :none)
      assert_kind_of String, engine2.src
    end

    test ":overlay mode compiles successfully with validation errors" do
      engine = Herb::Engine.new(@invalid_security_template, validation_mode: :overlay)

      assert_kind_of String, engine.src
      assert_includes engine.src, "<template"
      assert_includes engine.src, "data-herb-validation-error"
      assert_includes engine.src, 'data-source="SecurityValidator"'
      assert_includes engine.src, "herb-validation-item"
    end

    test ":overlay mode includes validation error details in HTML" do
      engine = Herb::Engine.new(@invalid_security_template, validation_mode: :overlay)

      template_match = engine.src.match(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)
      assert template_match, "Should contain validation error template"

      template = template_match[0]

      assert_includes template, 'data-severity="error"'
      assert_includes template, 'data-source="SecurityValidator"'
      assert_includes template, 'data-code="SecurityViolation"'
      assert_includes template, 'data-line="1"'
      assert_includes template, 'data-column="5"'
      assert_includes template, "data-message=", "Should contain error message"
      assert_includes template, "data-suggestion=", "Should contain suggestion"

      assert_includes template, "ERB output tags", "Should contain error message in HTML"
      assert_includes template, "herb-validation-item", "Should contain validation item HTML"
      assert_includes template, "Security", "Should contain validator badge"
    end

    test ":overlay mode with valid template does not include validation errors" do
      engine = Herb::Engine.new(@valid_template, validation_mode: :overlay)

      refute_includes engine.src, "<template"
      refute_includes engine.src, "data-herb-validation-error"
    end

    test "invalid validation_mode raises ArgumentError" do
      error = assert_raises(ArgumentError) do
        Herb::Engine.new(@valid_template, validation_mode: :invalid)
      end

      assert_includes error.message, "validation_mode must be one of :raise, :overlay, or :none"
      assert_includes error.message, ":invalid"
    end

    test ":overlay mode includes filename in HTML" do
      filename = "/path/to/template.html.erb"
      engine = Herb::Engine.new(@invalid_security_template,
                                validation_mode: :overlay,
                                filename: filename)

      template_match = engine.src.match(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)
      template = template_match[0]

      assert_includes template, "template.html.erb", "Should contain filename in the path"
    end

    test ":overlay mode includes timestamp in HTML" do
      engine = Herb::Engine.new(@invalid_security_template, validation_mode: :overlay)

      template_match = engine.src.match(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)
      template = template_match[0]

      timestamp_match = template.match(/data-timestamp="([^"]*)"/)
      assert timestamp_match, "Should contain timestamp attribute"

      parsed_time = Time.iso8601(timestamp_match[1])
      assert_kind_of Time, parsed_time
    end

    test ":overlay mode with multiple validation errors" do
      complex_invalid_template = '<div <%= @attr %> data-<%= @name %>="value">Content</div>'

      engine = Herb::Engine.new(complex_invalid_template, validation_mode: :overlay)

      templates = engine.src.scan(%r{<template[^>]*data-herb-validation-error[^>]*>.*?</template>}m)
      assert templates.length >= 1, "Should have at least one validation error"

      security_templates = templates.select { |template| template.include?('data-source="SecurityValidator"') }
      assert security_templates.length >= 1, "Should have at least one security error"
    end

    test "validation modes work with debug mode" do
      engine1 = Herb::Engine.new(@valid_template, validation_mode: :none, debug: true)
      assert_kind_of String, engine1.src

      engine2 = Herb::Engine.new(@valid_template, validation_mode: :overlay, debug: true)
      assert_kind_of String, engine2.src

      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, validation_mode: :raise, debug: true)
      end
    end
  end
end
