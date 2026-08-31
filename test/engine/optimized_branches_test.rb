# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require "herb/engine/visitors/optimize_visitor"

module Engine
  class OptimizedBranchesTest < Minitest::Spec
    include SnapshotUtils

    CONDITIONAL = <<~ERB
      <p>
        <% if flag %>
          Hello World
        <% else %>
          Hello Tomorrow
        <% end %>
      </p>
    ERB

    def optimize_options(**options)
      { visitors: [Herb::Engine::OptimizeVisitor.new], **options }
    end

    describe "what collapses into branch literals" do
      test "a conditional between static markup" do
        assert_compiled_snapshot(CONDITIONAL, optimize_options)
      end

      test "a conditional on one line" do
        assert_compiled_snapshot("<% if flag %>A<% else %>B<% end %>", optimize_options)
      end

      test "a conditional without an else" do
        assert_compiled_snapshot("<div>\n  <% if flag %>\n    shown\n  <% end %>\n</div>", optimize_options)
      end

      test "an elsif chain" do
        assert_compiled_snapshot(
          "<div>\n  <% if flag %>\n    one\n  <% elsif other %>\n    two\n  <% end %>\n</div>",
          optimize_options
        )
      end

      test "an unless" do
        assert_compiled_snapshot("<% unless flag %>\n  <span>Guest</span>\n<% end %>", optimize_options)
      end

      test "a conditional whose branches were folded literals" do
        assert_compiled_snapshot(%(<% if flag %><%= "yes" %><% else %><%= "no" %><% end %>), optimize_options)
      end

      test "a conditional inside an attribute value" do
        assert_compiled_snapshot(%(<ul class="<% if flag %>a<% else %>b<% end %>"></ul>), optimize_options)
      end

      test "a comment inside a branch" do
        assert_compiled_snapshot("<% if flag %>\n  <%# a\n  multiline comment %>\n  body\n<% end %>", optimize_options)
      end
    end

    describe "what keeps the buffer" do
      test "an expression inside a branch" do
        assert_compiled_snapshot("<% if flag %>\n  <%= greeting %>\n<% end %>", optimize_options)
      end

      test "a nested conditional" do
        assert_compiled_snapshot("<% if flag %>\n  <% if other %>\n    x\n  <% end %>\n<% end %>", optimize_options)
      end

      test "two conditionals" do
        assert_compiled_snapshot(
          "<% if flag %>a<% end %>\n<% if other %>b<% end %>",
          optimize_options
        )
      end

      test "a code tag beside the conditional" do
        assert_compiled_snapshot("<% count = 1 %>\n<% if flag %>a<% end %>", optimize_options)
      end
    end

    describe "what it renders" do
      test "renders the branch the condition picks" do
        assert_evaluated_snapshot(CONDITIONAL, { flag: true }, optimize_options)
      end

      test "renders the other branch when the condition falls through" do
        assert_evaluated_snapshot(CONDITIONAL, { flag: false }, optimize_options)
      end

      test "renders the surrounding markup alone without an else" do
        assert_evaluated_snapshot(
          "<div>\n  <% if flag %>\n    shown\n  <% end %>\n</div>",
          { flag: false },
          optimize_options
        )
      end
    end
  end
end
