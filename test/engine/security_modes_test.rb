# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class SecurityModesTest < Minitest::Spec
    include SnapshotUtils

    before do
      @security_violation_template = "<div <%= @malicious %>>Content</div>"
      @attribute_name_violation = '<div data-<%= @name %>="value">Content</div>'
      @valid_template = "<div>Valid template</div>"
    end

    test "security: 'error' mode raises SecurityError (default)" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@security_violation_template, security: :error)
      end

      assert_includes error.message, "ERB output tags"
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test "security mode defaults to 'error' when not specified" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@security_violation_template)
      end

      assert_includes error.message, "ERB output tags"
    end

    test "security: 'warn' mode logs warning but compiles successfully" do
      original_stderr = $stderr
      $stderr = StringIO.new

      engine = Herb::Engine.new(@security_violation_template, security: :warn)

      $stderr.rewind
      output = $stderr.read
      $stderr = original_stderr

      assert output.include?("WARNING: Security issue")
      assert output.include?("ERB output tags")
      assert output.include?("Suggestion:")
      assert_kind_of String, engine.src
    end

    test "security: 'ignore' mode silently skips security validation" do
      engine = Herb::Engine.new(@security_violation_template, security: :ignore)

      assert_kind_of String, engine.src
      refute_empty engine.src
    end

    test "security: 'warn' mode logs multiple security violations" do
      template = '<div <%= @attr1 %> data-<%= @name %>="value">Content</div>'

      original_stderr = $stderr
      $stderr = StringIO.new

      engine = Herb::Engine.new(template, security: :warn)

      $stderr.rewind
      output = $stderr.read
      $stderr = original_stderr

      assert output.scan("WARNING: Security issue").count >= 1
      assert_kind_of String, engine.src
    end

    test "security: 'error' mode still raises non-security validation errors" do
      invalid_nesting_template = "<p><div>Invalid nesting</div></p>"

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(invalid_nesting_template, security: :error)
      end

      assert_includes error.message, "InvalidNestingError"
    end

    test "security: 'warn' mode still raises non-security validation errors" do
      invalid_nesting_template = "<p><div>Invalid nesting</div></p>"

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(invalid_nesting_template, security: :warn)
      end

      assert_includes error.message, "InvalidNestingError"
    end

    test "security: 'ignore' mode still raises non-security validation errors" do
      invalid_nesting_template = "<p><div>Invalid nesting</div></p>"

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(invalid_nesting_template, security: :ignore)
      end

      assert_includes error.message, "InvalidNestingError"
    end

    test "invalid security mode raises ArgumentError" do
      error = assert_raises(ArgumentError) do
        Herb::Engine.new(@valid_template, security: :invalid)
      end

      assert_includes error.message, 'security must be one of :error, :warn, or :ignore'
      assert_includes error.message, ':invalid'
    end

    test "security mode works with validation_mode: :overlay" do
      # When validation_mode is :overlay, validation errors are rendered as an overlay
      # rather than raising or logging to stderr
      engine = Herb::Engine.new(@security_violation_template,
                                security: :warn,
                                validation_mode: :overlay)

      assert_kind_of String, engine.src
    end

    test "security mode works with validation_mode: :none" do
      # When validation_mode is :none, security checks don't run
      engine = Herb::Engine.new(@security_violation_template,
                                security: :error,
                                validation_mode: :none)

      assert_kind_of String, engine.src
    end

    test "security: 'warn' includes filename in warning message" do
      original_stderr = $stderr
      $stderr = StringIO.new

      Herb::Engine.new(@security_violation_template,
                       security: :warn,
                       filename: "test_template.html.erb")

      $stderr.rewind
      output = $stderr.read
      $stderr = original_stderr

      assert output.include?("test_template.html.erb")
    end

    test "security: 'warn' formats location without filename" do
      original_stderr = $stderr
      $stderr = StringIO.new

      Herb::Engine.new(@security_violation_template, security: :warn)

      $stderr.rewind
      output = $stderr.read
      $stderr = original_stderr

      assert output.match?(/\d+:\d+/)
    end

    test "security mode reads from .herb.yml configuration" do
      temp_dir = Dir.mktmpdir("herb_security_config_test")
      File.write(File.join(temp_dir, ".herb.yml"), "engine:\n  security: ignore\n")

      Herb.configure(temp_dir)

      engine = Herb::Engine.new(@security_violation_template)
      assert_kind_of String, engine.src
      assert_equal :ignore, engine.security_mode
    ensure
      Herb.reset_configuration!
      FileUtils.rm_rf(temp_dir)
    end

    test "explicit security parameter overrides .herb.yml configuration" do
      temp_dir = Dir.mktmpdir("herb_security_config_test")
      File.write(File.join(temp_dir, ".herb.yml"), "engine:\n  security: ignore\n")

      Herb.configure(temp_dir)

      assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@security_violation_template, security: :error)
      end
    ensure
      Herb.reset_configuration!
      FileUtils.rm_rf(temp_dir)
    end
  end
end
