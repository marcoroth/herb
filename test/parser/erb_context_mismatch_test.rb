# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBContextMismatchTest < Minitest::Spec
    include SnapshotUtils

    # https://github.com/marcoroth/herb/issues/701
    test "out of order closing tags across ERB blocks" do
      assert_parsed_snapshot(<<~ERB)
        <div class="h-screen">
          <div class="page-container">
            <div class="max-w-lg mx-auto">
              <%= render CardComponent.new do |card| %>
            </div>

            <% end %>
          </div>
        </div>
      ERB
    end

    # https://github.com/marcoroth/herb/issues/398
    test "conditionally opening tag then closing unconditionally" do
      assert_parsed_snapshot(<<~ERB)
        <% if some_condition %>
          <div class="a">
        <% else %>
          <div class="b">
        <% end %>
          Content
        </div>
      ERB
    end

    # https://github.com/marcoroth/herb/issues/399
    test "opening and closing tag in different if blocks" do
      assert_parsed_snapshot(<<~ERB)
        <% if wrap_in_dialog? %>
          <dialog>
        <% end %>

        <div>Stuff</div>

        <% if wrap_in_dialog? %>
          </dialog>
        <% end %>
      ERB
    end

    # https://github.com/marcoroth/herb/issues/490
    test "tag opened in elsif closed outside conditional" do
      assert_parsed_snapshot(<<~ERB)
        <nav>
          <ul>
            <% if magic == :foo %>
              <li class="foo">
                <a href="foo">foo</a>
            <% elsif magic == :bar %>
              <li class="bar">
                <a href="bar">bar</a>
            <% else %>
              <li>
                <span>DEFAULT</span>
            <% end %>
            </li>
          </ul>
        </nav>
      ERB
    end

    # https://github.com/marcoroth/herb/issues/83
    test "element opened in block must be closed within block" do
      assert_parsed_snapshot(<<~ERB)
        <% if true %>
          <h1>123
        <% end %>
        </h1>
      ERB
    end

    # https://github.com/marcoroth/herb/issues/84
    test "opening in one context and closing in another context" do
      assert_parsed_snapshot(<<~ERB)
        <% if true %>
          <h1>
        <% end %>

          Content

        <% if true %>
          </h1>
        <% end %>
      ERB
    end

    test "stray closing tag without opening" do
      assert_parsed_snapshot(<<~ERB)
        <div>
          content
        </div>
        </span>
      ERB
    end

    test "unclosed tag without closing" do
      assert_parsed_snapshot(<<~ERB)
        <div>
          <span>content
        </div>
      ERB
    end
  end
end
