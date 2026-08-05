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

    test "complete elements in if/else should not trigger error" do
      assert_parsed_snapshot(<<~HTML)
        <div class="outer">
          <% if condition %>
            <div class="inner">A</div>
          <% else %>
            <div class="inner">B</div>
          <% end %>
        </div>
      HTML
    end

    test "multiple complete elements in if/else should not trigger error" do
      assert_parsed_snapshot(<<~HTML)
        <div class="text-center">
          <% if @event.retreat? %>
            <div class="mb-1"><%= duration %></div>
            <div class="text-sm">Days</div>
          <% else %>
            <div class="mb-1"><%= count %></div>
            <div class="text-sm">Talks</div>
          <% end %>
        </div>
      HTML
    end

    test "nested complete elements with ERB content inside if/else" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <% x = 1 %>
          <div class="outer">
            <div class="inner1">content1</div>
            <div class="inner2">content2</div>
          </div>
        <% elsif condition2 %>
          <div class="outer">
            <div class="inner1">content1</div>
            <div class="inner2">content2</div>
          </div>
        <% end %>
      HTML
    end

    test "if/elsif with each block inside branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div class="container">
            <div class="items">
              <% items.each do |item| %>
                <div class="item"><%= item %></div>
              <% end %>
            </div>
          </div>
        <% elsif other_condition %>
          <div class="container">
            <span>No items</span>
          </div>
        <% end %>
      HTML
    end

    test "deeply nested if/else with complete elements (rubyevents pattern)" do
      assert_parsed_snapshot(<<~HTML)
        <%= turbo_frame_tag do %>
          <div class="container">
            <div class="flex">
              <section>
                <div class="grid">
                  <div class="text-center">
                    <% if @event.retreat? %>
                      <div class="mb-1"><%= duration %></div>
                      <div class="text-sm">Days</div>
                    <% else %>
                      <div class="mb-1"><%= count %></div>
                      <div class="text-sm">Talks</div>
                    <% end %>
                  </div>
                </div>
              </section>
            </div>
          </div>
        <% end %>
      HTML
    end

    test "complete elements with erb if/end inside if/else branches (issue #1239)" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
          <div>
            <div></div>
            <% if true %><% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "nested if/else with complete elements and inner erb control flow (issue #1239)" do
      assert_parsed_snapshot(<<~HTML)
        <% if true %>
          <% if true %>
            <div>
              <div></div>
              <% if true %><% end %>
            </div>
          <% else %>
            <div></div>
          <% end %>
        <% end %>
      HTML
    end

    test "complete elements with erb while inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <span></span>
            <% while x > 0 %>
              <p><%= x %></p>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "complete elements with erb each block inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% items.each do |item| %>
              <span><%= item %></span>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "complete elements with erb unless inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% unless hidden %>
              <span>visible</span>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "complete elements with erb begin/rescue inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% begin %>
              <span><%= dangerous_call %></span>
            <% rescue %>
              <span>error</span>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "complete elements with erb case/when inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% case status %>
            <% when :active %>
              <span>active</span>
            <% when :inactive %>
              <span>inactive</span>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "erb if/end before complete element in branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <% if setup %><% end %>
          <div></div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "multiple erb control flow nodes with complete element in branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% if a %><% end %>
            <% items.each do |item| %>
              <span><%= item %></span>
            <% end %>
            <% if b %><% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "if/elsif/else with erb control flow in each branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if a %>
          <div>
            <% if x %><% end %>
          </div>
        <% elsif b %>
          <div>
            <% items.each do |i| %><% end %>
          </div>
        <% else %>
          <div>
            <% while c %><% end %>
          </div>
        <% end %>
      HTML
    end

    test "complete elements with erb until inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% until done %>
              <p>waiting</p>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "complete elements with erb for inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% for item in items %>
              <span><%= item %></span>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "complete elements with erb if/elsif/else inside if/else branches" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% if inner_a %>
              <span>a</span>
            <% elsif inner_b %>
              <span>b</span>
            <% else %>
              <span>c</span>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "erb block before complete element in branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <% items.each do |item| %><% end %>
          <div></div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "deeply nested erb control flow inside branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% items.each do |item| %>
              <% if item.visible? %>
                <span><%= item.name %></span>
              <% end %>
            <% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "html comment alongside complete element in branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <!-- a comment -->
          <div></div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "erb output tag alongside complete element in branch" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <%= some_helper %>
          <div></div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end

    test "both branches have erb control flow with complete elements" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <% if inner %><% end %>
          </div>
        <% else %>
          <div>
            <% unless inner %><% end %>
          </div>
        <% end %>
      HTML
    end

    test "unless/else with erb control flow inside branch" do
      assert_parsed_snapshot(<<~HTML)
        <% unless condition %>
          <div>
            <% if inner %><% end %>
          </div>
        <% else %>
          <div></div>
        <% end %>
      HTML
    end
  end
end
