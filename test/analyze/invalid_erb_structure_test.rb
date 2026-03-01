# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class InvalidERBStructureTest < Minitest::Spec
    include SnapshotUtils

    test "tags spanning erb control flow boundaries - opening tag in first if" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition? %>
          <div>
        <% end %>

        <% if condition? %>
          </div>
        <% end %>
      HTML
    end

    test "invalid erb structure - else outside scope after tag closing" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% if some_condition %>
            class="a"
        >
          <% else %>
          <% end %>
        </div>
      HTML
    end

    test "invalid erb structure - end outside scope after tag closing" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% if some_condition %>
            class="a"
        >
          <% end %>
        </div>
      HTML
    end

    test "invalid erb structure - elsif outside scope after tag closing" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% if some_condition %>
        >
          <% elsif other_condition %>
          <% end %>
        </div>
      HTML
    end

    test "invalid erb structure - else outside scope before tag closing" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% if some_condition %>
            class="a"
          <% else %>
        >
        <% end %>

        </div>
      HTML
    end

    test "invalid erb structure - if/else spans across attribute value quotes" do
      assert_parsed_snapshot(<<~HTML)
        <div class="<% if some_condition %>a<% else %>b"<% end %>>
          Content
        </div>
      HTML
    end

    test "invalid erb structure - multiline attribute value spans across if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% if some_condition %>
            class="a
          <% else %>
            b"
          <% end %>
        >
          Content
        </div>
      HTML
    end

    test "invalid erb structure - attribute quote closes in if branch with else/end outside" do
      assert_parsed_snapshot(<<~HTML)
        <div class="a <% if some_condition %>"
          <% else %>
        >
        <% end %>

        </div>
      HTML
    end

    test "valid erb structure - if/else/end inside tag attributes" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% if some_condition %>
            class="a"
          <% else %>
            class="b"
          <% end %>
        ></div>
      HTML
    end

    test "invalid erb structure - when outside case scope" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% case value %>
          <% when 1 %>
            class="a"
        >
        <% end %>
        </div>
      HTML
    end

    test "invalid erb structure - rescue outside begin scope" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% begin %>
            data-value="test"
        >
          <% rescue %>
          <% end %>
        </div>
      HTML
    end

    test "invalid erb structure - ensure outside begin scope" do
      assert_parsed_snapshot(<<~HTML)
        <div
          <% begin %>
            data-value="test"
        >
          <% ensure %>
          <% end %>
        </div>
      HTML
    end

    test "tags in different erb scopes - unless blocks" do
      assert_parsed_snapshot(<<~HTML)
        <% unless disabled? %>
          <section>
        <% end %>

        <% unless enabled? %>
          </section>
        <% end %>
      HTML
    end

    test "tags in different erb scopes - while blocks" do
      assert_parsed_snapshot(<<~HTML)
        <% while items.any? %>
          <ul>
        <% end %>

        <% while other_items.any? %>
          </ul>
        <% end %>
      HTML
    end

    test "tags in different erb scopes - for blocks" do
      assert_parsed_snapshot(<<~HTML)
        <% for item in items %>
          <div>
        <% end %>

        <% for item in other_items %>
          </div>
        <% end %>
      HTML
    end

    test "missing close HTML tag in else clause" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% if true %>
            <div>Text1</div>
          <% elsif false %>
            <div>Text2</div>
          <% else %>
            <div>Text3
          <% end %>
        </h1>
      HTML
    end

    test "elsif in class attribute value scope" do
      assert_parsed_snapshot(<<~HTML)
        <h1 <% if true %> class="<% elsif true %>" <% end %>>
          Content
        </h1>
      HTML
    end

    test "conditional attributes without space before ERB closing tag" do
      skip "<% end %> shouldn't be treated as the value of disabled"

      assert_parsed_snapshot(<<~HTML)
        <button
          type="submit"
          <% if false %> disabled<% end %>
          <% if false %> aria-busy="true" <% end %>
          class="btn"
        >Submit</button>
      HTML
    end

    test "conditional attributes with space before ERB closing tag" do
      assert_parsed_snapshot(<<~HTML)
        <button
          type="submit"
          <% if false %> disabled <% end %>
          <% if false %> aria-busy="true" <% end %>
          class="btn"
        >Submit</button>
      HTML
    end

    test "invalid break outside of loop context" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <% break %>
        </div>
      HTML
    end

    test "invalid next outside of loop context" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <% next %>
        </div>
      HTML
    end

    test "invalid redo outside of loop context" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <% redo %>
        </div>
      HTML
    end

    test "invalid retry outside of rescue context" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <% retry %>
        </div>
      HTML
    end

    test "invalid break in if statement outside of loop" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition? %>
          <% break %>
        <% end %>
      HTML
    end

    test "invalid next in case statement outside of loop" do
      assert_parsed_snapshot(<<~HTML)
        <% case value %>
        <% when 1 %>
          <% next %>
        <% end %>
      HTML
    end

    test "invalid break at document root after while loop" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          content
        <% end %>

        <% break %>
      HTML
    end

    test "loop control keywords in various contexts (retry, break, next, redo)" do
      assert_parsed_snapshot(<<~HTML)
        <% while true %>
          <% retry %>
          <% break %>
          <% next %>
          <% redo %>
        <% end %>

        <% loop do %>
          <% retry %>
          <% break %>
          <% next %>
          <% redo %>
        <% end %>

        <% begin %>
          <% retry %>
        <% rescue %>
          <% retry %>
          <% break %>
          <% next %>
          <% redo %>
        <% end %>

        <% break %>
        <% next %>
        <% retry %>
        <% redo %>
      HTML
    end
  end
end
