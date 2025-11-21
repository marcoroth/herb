# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class ValidationModesTest < Minitest::Spec
    include SnapshotUtils

    before do
      @valid_template = "<div>Valid template</div>"
      @invalid_security_template = "<div <%= @malicious %>>Content</div>"
      @invalid_nesting_template = "<p><div>Invalid nesting</div></p>"
    end

    around do |test|
      @fixed_time = Time.utc(2025, 1, 1, 12, 0, 0)

      Time.stub :now, @fixed_time do
        test.call
      end
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

      assert_includes error.message, "HTML+ERB Compilation Errors"
      assert_includes error.message, "InvalidNestingError"
      assert_includes error.message, "Block element <div> cannot be nested inside <p>"
      assert_includes error.message, "Location: Line 1, Column 3"
      assert_includes error.message, "Total errors: 1"
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
      assert_compiled_snapshot(@invalid_security_template, validation_mode: :none)
      assert_compiled_snapshot('<div data-<%= @name %>="value">Content</div>', validation_mode: :none)
    end

    test ":overlay mode compiles successfully with validation errors" do
      assert_compiled_snapshot(@invalid_security_template, validation_mode: :overlay)
    end

    test ":overlay mode with valid template does not include validation errors" do
      assert_compiled_snapshot(@valid_template, validation_mode: :overlay)
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
      project_path = "/path"

      assert_compiled_snapshot(@invalid_security_template, validation_mode: :overlay, filename: filename, project_path: project_path)
    end

    test ":overlay mode with multiple validation errors" do
      complex_invalid_template = '<div <%= @attr %> data-<%= @name %>="value">Content</div>'

      assert_compiled_snapshot(complex_invalid_template, validation_mode: :overlay)
    end

    test "validation modes work with debug mode" do
      engine1 = assert_compiled_snapshot(@valid_template, validation_mode: :none, debug: true)
      assert_kind_of String, engine1.src

      engine2 = assert_compiled_snapshot(@valid_template, validation_mode: :overlay, debug: true)
      assert_kind_of String, engine2.src

      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@invalid_security_template, validation_mode: :raise, debug: true)
      end
    end
  end
end
