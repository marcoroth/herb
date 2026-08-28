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

      test "ternary with string literals in both branches" do
        assert_optimized_snapshot(
          '<%= active ? "On" : "Off" %>',
          { active: true }
        )
      end

      test "ternary with string literals inside an attribute value" do
        assert_optimized_snapshot(
          '<div class="<%= active ? "on" : "off" %>">Body</div>',
          { active: true }
        )
      end

      test "ternary with literals that would be HTML-escaped" do
        assert_compiled_snapshot(
          '<%= active ? "5 > 3" : "a & b" %>',
          escape: true,
          visitors: [Herb::Engine::Visitors::Optimize.new]
        )
      end
    end
  end
end
