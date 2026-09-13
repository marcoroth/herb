# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"

module Engine
  class ControlFlowClosingTest < Minitest::Spec
    include SnapshotUtils

    test "else and end in same ERB tag" do
      template = <<~ERB
        <% if condition %>
          <span>Yes</span>
        <% else
        end %>
      ERB

      assert_evaluated_snapshot(template, { condition: true }, { escape: false })
      assert_evaluated_snapshot(template, { condition: false }, { escape: false })
    end

    test "else with a body and end in same ERB tag" do
      template = <<~ERB
        <% if condition %>
          <span>Yes</span>
        <%
        else
          value = "No"
        end
        %>
        <span><%= value %></span>
      ERB

      assert_evaluated_snapshot(template, { condition: false }, { escape: false })
    end

    test "elsif and end in same ERB tag" do
      template = <<~ERB
        <% if first %>
          <span>First</span>
        <% elsif second
        end %>
      ERB

      assert_evaluated_snapshot(template, { first: true, second: false }, { escape: false })
      assert_evaluated_snapshot(template, { first: false, second: true }, { escape: false })
    end

    test "when and end in same ERB tag" do
      template = <<~ERB
        <% case status %>
        <% when "ok"
        end %>
      ERB

      assert_evaluated_snapshot(template, { status: "ok" }, { escape: false })
      assert_evaluated_snapshot(template, { status: "other" }, { escape: false })
    end

    test "rescue and end in same ERB tag" do
      template = <<~ERB
        <% begin %>
          <span>Body</span>
        <% rescue
        end %>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "ensure and end in same ERB tag" do
      template = <<~ERB
        <% begin %>
          <span>Body</span>
        <% ensure
        end %>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "unless with else and end in same ERB tag" do
      template = <<~ERB
        <% unless condition %>
          <span>No</span>
        <% else
        end %>
      ERB

      assert_evaluated_snapshot(template, { condition: true }, { escape: false })
      assert_evaluated_snapshot(template, { condition: false }, { escape: false })
    end
  end
end
