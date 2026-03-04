# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"

module Engine
  class CaseTest < Minitest::Spec
    include SnapshotUtils

    test "case when in same ERB tag" do
      template = <<~ERB
        <% case status when "pending" %>
          <span>Pending</span>
        <% when "approved" %>
          <span>Approved</span>
        <% else %>
          <span>Unknown</span>
        <% end %>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template, strict: true)
      end

      assert_includes error.message, "ERBCaseWithConditions"

      assert_evaluated_snapshot(template, { status: "pending" }, { escape: false, strict: false })
      assert_evaluated_snapshot(template, { status: "approved" }, { escape: false, strict: false })
      assert_evaluated_snapshot(template, { status: "other" }, { escape: false, strict: false })
    end

    test "case in pattern in same ERB tag" do
      template = <<~ERB
        <% case count in 1 %>
          <span>One</span>
        <% in 2 %>
          <span>Two</span>
        <% else %>
          <span>Other</span>
        <% end %>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template, strict: true)
      end

      assert_includes error.message, "ERBCaseWithConditions"
    end

    test "case when on newline in same ERB tag" do
      template = <<~ERB
        <% case status
           when "pending" %>
          <span>Pending</span>
        <% when "approved" %>
          <span>Approved</span>
        <% end %>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template, strict: true)
      end

      assert_includes error.message, "ERBCaseWithConditions"

      assert_evaluated_snapshot(template, { status: "pending" }, { escape: false, strict: false })
      assert_evaluated_snapshot(template, { status: "approved" }, { escape: false, strict: false })
    end

    test "case in on newline in same ERB tag" do
      template = <<~ERB
        <% case count
           in 1 %>
          <span>One</span>
        <% in 2 %>
          <span>Two</span>
        <% end %>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template, strict: true)
      end

      assert_includes error.message, "ERBCaseWithConditions"

      assert_evaluated_snapshot(template, { count: 1 }, { escape: false, strict: false })
      assert_evaluated_snapshot(template, { count: 2 }, { escape: false, strict: false })
    end
  end
end
