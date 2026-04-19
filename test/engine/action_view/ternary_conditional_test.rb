# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class TernaryConditionalTest < Minitest::Spec
      include ActionViewTestHelper

      test "ternary with tag helpers in both branches" do
        assert_optimized_snapshot(
          '<%= active ? tag.div("On") : tag.span("Off") %>',
          { active: true }
        )
      end

      test "ternary with different element types" do
        assert_optimized_snapshot(
          '<%= condition ? tag.strong("Yes") : tag.em("No") %>',
          { condition: false }
        )
      end

      test "ternary with link_to in true branch" do
        assert_optimized_snapshot(
          '<%= admin ? link_to("Dashboard", "/admin") : link_to("Home", "/") %>',
          { admin: true }
        )
      end

      test "non-output ternary without helpers is not transformed" do
        assert_optimized_snapshot(
          '<% admin ? "Admin" : "User" %>',
          { admin: true }
        )
      end

      test "non-output ternary with helpers is not transformed" do
        assert_optimized_snapshot(
          '<% admin ? tag.div("Admin") : tag.span("User") %>',
          { admin: true }
        )
      end
    end
  end
end
