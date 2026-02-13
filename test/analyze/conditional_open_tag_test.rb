# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class ConditionalOpenTagTest < Minitest::Spec
    include SnapshotUtils

    test "simple if/else with different classes (issue #398)" do
      assert_parsed_snapshot(<<~HTML)
        <% if some_condition %>
          <div class="a">
        <% else %>
          <div class="b">
        <% end %>
          Content
        </div>
      HTML
    end

    test "if/else with li tags (issue #490)" do
      assert_parsed_snapshot(<<~HTML)
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
      HTML
    end

    test "conditional with style attribute (issue #779)" do
      assert_parsed_snapshot(<<~HTML)
        <% if meal_course.background_image.attached? %>
          <div class='bg_button_gradient' style='background-image: url(<%= image %>);'>
        <% else %>
          <div class='bg_button_gradient' style='background-image: none;'>
        <% end %>
          Content here
        </div>
      HTML
    end

    test "simple unless/else conditional open tag" do
      assert_parsed_snapshot(<<~HTML)
        <% unless @compact %>
          <div class="expanded">
        <% else %>
          <div class="compact">
        <% end %>
          Content
        </div>
      HTML
    end

    test "if/elsif/else with same tag name" do
      assert_parsed_snapshot(<<~HTML)
        <% if @type == :primary %>
          <button class="primary">
        <% elsif @type == :secondary %>
          <button class="secondary">
        <% else %>
          <button class="default">
        <% end %>
          Click me
        </button>
      HTML
    end

    test "if/elsif/else with missing tag in if" do
      assert_parsed_snapshot(<<~HTML)
        <% if @type == :primary %>
          <%# no-tag %>
        <% elsif @type == :secondary %>
          <button class="secondary">
        <% else %>
          <button class="default">
        <% end %>
          Click me
        </button>
      HTML
    end

    test "if/elsif/else with missing tag in elsif" do
      assert_parsed_snapshot(<<~HTML)
        <% if @type == :primary %>
          <button class="primary">
        <% elsif @type == :secondary %>
          <%# no-tag %>
        <% else %>
          <button class="default">
        <% end %>
          Click me
        </button>
      HTML
    end

    test "if/elsif/else with missing tag in else" do
      assert_parsed_snapshot(<<~HTML)
        <% if @type == :primary %>
          <button class="primary">
        <% elsif @type == :secondary %>
          <button class="secondary">
        <% else %>
          <%# no-tag %>
        <% end %>
          Click me
        </button>
      HTML
    end

    test "nested elements inside conditional open tag body" do
      assert_parsed_snapshot(<<~HTML)
        <% if @big %>
          <section class="big-section">
        <% else %>
          <section class="small-section">
        <% end %>
          <h1>Title</h1>
          <p>Content</p>
          <% if @extra %>
            <span>Extra content</span>
          <% end %>
        </section>
      HTML
    end

    test "non-matching: different tag names in branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div class="a">
        <% else %>
          <span class="b">
        <% end %>
          Content
        </div>
      HTML
    end

    test "non-matching: missing else branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div class="a">
        <% end %>
          Content
        </div>
      HTML
    end

    test "non-matching: void element in conditional" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <br class="a">
        <% else %>
          <br class="b">
        <% end %>
      HTML
    end

    test "non-matching: close tag is also conditional" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div class="a">
        <% else %>
          <div class="b">
        <% end %>
          Content
        <% if @condition %>
          </div>
        <% else %>
          </div>
        <% end %>
      HTML
    end

    test "all branches need to have a tag and match the tag name" do
      assert_parsed_snapshot(<<~HTML)
        <% if some_condition %>
          <div class="a">
        <% elsif other_condition %>
          <div class="b">
        <% else %>
          <%# no-tag %>
        <% end %>
          Content
        </div>
      HTML
    end

    test "if/elsif/else branches have open tags" do
      assert_parsed_snapshot(<<~HTML)
        <% if some_condition %>
          <div class="a">
        <% elsif other_condition %>
          <div class="b">
        <% else %>
          <div class="c">
        <% end %>
          Content
        </div>
      HTML
    end

    test "non-matching: multiple open tags in branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div class="a">
          <span class="inner">
        <% else %>
          <div class="b">
        <% end %>
          Content
        </div>
      HTML
    end
  end
end
