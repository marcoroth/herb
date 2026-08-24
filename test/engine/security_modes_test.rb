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
        Herb::Engine.new(@security_violation_template, visitors: Herb::Engine::Validators.all)
      end

      assert_equal "1:5 - ERB output tags (<%= %>) are not allowed in attribute position. - Suggestion: Use control flow (<% %>) with static attributes instead.", error.message
      assert_equal 1, error.line
      assert_equal 5, error.column
    end

    test "security validator can be disabled" do
      engine = Herb::Engine.new(@security_violation_template, visitors: Herb::Engine::Validators.all(security: false))

      assert_kind_of String, engine.src
      refute_empty engine.src
    end

    test "nesting validator raises CompilationError by default" do
      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(@invalid_nesting_template, visitors: Herb::Engine::Validators.all)
      end

      assert_includes error.message, "invalid-nesting"
    end

    test "nesting validator can be disabled" do
      engine = Herb::Engine.new(@invalid_nesting_template, visitors: Herb::Engine::Validators.all(nesting: false))

      assert_kind_of String, engine.src
    end

    test "disabling security does not disable nesting" do
      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(@invalid_nesting_template, visitors: Herb::Engine::Validators.all(security: false))
      end

      assert_includes error.message, "invalid-nesting"
    end

    test "disabling nesting does not disable security" do
      error = assert_raises(Herb::Engine::SecurityError) do
        Herb::Engine.new(@security_violation_template, visitors: Herb::Engine::Validators.all(nesting: false))
      end

      assert_equal "1:5 - ERB output tags (<%= %>) are not allowed in attribute position. - Suggestion: Use control flow (<% %>) with static attributes instead.", error.message
    end

    test "multiple validators can be disabled" do
      template = "<p><div <%= @attr %>>Content</div></p>"

      engine = Herb::Engine.new(template, visitors: Herb::Engine::Validators.all(security: false, nesting: false))

      assert_kind_of String, engine.src
    end

    test "a switched-off validator stays off when the rest are not fatal" do
      engine = Herb::Engine.new(
        @security_violation_template,
        visitors: Herb::Engine::Validators.all(security: false, fatal: false)
      )

      assert_kind_of String, engine.src
    end

    test "validators do not run when visitors: []" do
      engine = Herb::Engine.new(@security_violation_template, visitors: [])

      assert_kind_of String, engine.src
    end

    test "leaves out a validator that configuration switches off" do
      stack = Herb::Engine::Validators.all(security: false)

      refute stack.include_visitor?(Herb::Engine::Validators::SecurityValidator)
      assert stack.include_visitor?(Herb::Engine::Validators::NestingValidator)
      assert stack.include_visitor?(Herb::Engine::Validators::AccessibilityValidator)
    end

    test "builds every validator that configuration leaves on" do
      stack = Herb::Engine::Validators.all

      assert stack.include_visitor?(Herb::Engine::Validators::SecurityValidator)
      assert stack.include_visitor?(Herb::Engine::Validators::NestingValidator)
      assert stack.include_visitor?(Herb::Engine::Validators::AccessibilityValidator)
    end

    test "builds the render validator only when asked" do
      refute Herb::Engine::Validators.all.include_visitor?(Herb::Engine::Validators::RenderValidator)
      assert Herb::Engine::Validators.all(render: true).include_visitor?(Herb::Engine::Validators::RenderValidator)
    end
  end
end
