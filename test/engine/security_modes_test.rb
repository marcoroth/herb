# frozen_string_literal: true

require_relative "../test_helper"

module Engine
  class ValidatorConfigTest < Minitest::Spec
    include SnapshotUtils

    before do
      @security_violation_template = "<div <%= @malicious %>>Content</div>"
      @attribute_name_violation = '<div data-<%= @name %>="value">Content</div>'
      @valid_template = "<div>Valid template</div>"
      @invalid_nesting_template = "<p><div>Invalid nesting</div></p>"
    end

    test "security validator raises SecurityError by default" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@security_violation_template)
      end

      assert_includes error.message, "ERB output tags"
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test "security validator can be disabled" do
      engine = Herb::Engine.new(@security_violation_template, validators: { security: false })

      assert_kind_of String, engine.src
      refute_empty engine.src
    end

    test "nesting validator raises CompilationError by default" do
      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(@invalid_nesting_template)
      end

      assert_includes error.message, "InvalidNestingError"
    end

    test "nesting validator can be disabled" do
      engine = Herb::Engine.new(@invalid_nesting_template, validators: { nesting: false })

      assert_kind_of String, engine.src
    end

    test "disabling security does not disable nesting" do
      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(@invalid_nesting_template, validators: { security: false })
      end

      assert_includes error.message, "InvalidNestingError"
    end

    test "disabling nesting does not disable security" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@security_violation_template, validators: { nesting: false })
      end

      assert_includes error.message, "ERB output tags"
    end

    test "multiple validators can be disabled" do
      template = "<p><div <%= @attr %>>Content</div></p>"

      engine = Herb::Engine.new(template, validators: {
        security: false,
        nesting: false,
      })

      assert_kind_of String, engine.src
    end

    test "disabled validators work with validation_mode: :overlay" do
      engine = Herb::Engine.new(@security_violation_template,
                                validators: { security: false },
                                validation_mode: :overlay)

      assert_kind_of String, engine.src
    end

    test "validators do not run when validation_mode: :none" do
      engine = Herb::Engine.new(@security_violation_template,
                                validation_mode: :none)

      assert_kind_of String, engine.src
    end

    test "enabled_validators returns resolved config" do
      engine = Herb::Engine.new(@valid_template, validators: { security: false })

      assert_equal false, engine.enabled_validators[:security]
      assert_equal true, engine.enabled_validators[:nesting]
      assert_equal true, engine.enabled_validators[:accessibility]
    end

    test "all validators enabled by default" do
      engine = Herb::Engine.new(@valid_template)

      assert_equal true, engine.enabled_validators[:security]
      assert_equal true, engine.enabled_validators[:nesting]
      assert_equal true, engine.enabled_validators[:accessibility]
    end
  end
end
