# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class ConditionalElementTest < Minitest::Spec
    include SnapshotUtils

    test "simple conditional element" do
      assert_parsed_snapshot(<<~HTML)
        <% if @with_icon %>
          <div class="icon">
        <% end %>
          <span>Hello</span>
        <% if @with_icon %>
          </div>
        <% end %>
      HTML
    end

    test "conditional element with unless" do
      assert_parsed_snapshot(<<~HTML)
        <% unless @compact %>
          <div class="wrapper">
        <% end %>
          <span>Content</span>
        <% unless @compact %>
          </div>
        <% end %>
      HTML
    end

    test "nested conditional elements" do
      assert_parsed_snapshot(<<~HTML)
        <% if @outer %>
          <div class="outer">
        <% end %>
          <% if @inner %>
            <div class="inner">
          <% end %>
            <span>Nested</span>
          <% if @inner %>
            </div>
          <% end %>
        <% if @outer %>
          </div>
        <% end %>
      HTML
    end

    test "conditional element with body content" do
      assert_parsed_snapshot(<<~HTML)
        <% if @with_wrapper %>
          <section class="wrapper">
        <% end %>
          <h1>Title</h1>
          <p>Description</p>
          <% if true %>
            <span>Conditional inside</span>
          <% end %>
        <% if @with_wrapper %>
          </section>
        <% end %>
      HTML
    end

    test "conditional element with attributes" do
      assert_parsed_snapshot(<<~HTML)
        <% if @styled %>
          <div id="container" class="styled" data-value="test">
        <% end %>
          <span>Content</span>
        <% if @styled %>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: if vs unless should not match" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div>
        <% end %>
          <span>Content</span>
        <% unless @condition %>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: different conditions" do
      assert_parsed_snapshot(<<~HTML)
        <% if @open_condition %>
          <div>
        <% end %>
          <span>Content</span>
        <% if @close_condition %>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: else branch present" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div>
        <% else %>
          <span>Else content</span>
        <% end %>
          <span>Content</span>
        <% if @condition %>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: multiple tags in conditional" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div>
          <span>Extra tag</span>
        <% end %>
          Content
        <% if @condition %>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: multiple nested open and close tags in same conditional" do
      assert_parsed_snapshot(<<~HTML)
        <% if @wrapped %>
          <div class="outer">
            <div class="inner">
        <% end %>
          <span>Body</span>
        <% if @wrapped %>
            </div>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: nested conditionals with different nesting in open and close" do
      assert_parsed_snapshot(<<~HTML)
        <% if true? %>
          <% if something? %>
            <div class="outer">
          <% end %>
          <div class="inner">
        <% end %>
        <span>Body</span>
        <% if true? %>
            </div>
          <% if something? %>
            </div>
          <% end %>
        <% end %>
      HTML
    end

    test "non-matching: condition mismatch" do
      assert_parsed_snapshot(<<~HTML)
        <% if true? %>
          <div class="outer">
        <% end %>
        <span>Body</span>
        <% if true %>
          </div>
        <% end %>
      HTML
    end

    test "non-matching: different tag names" do
      assert_parsed_snapshot(<<~HTML)
        <% if @condition %>
          <div>
        <% end %>
          <span>Content</span>
        <% if @condition %>
          </span>
        <% end %>
      HTML
    end

    test "conditional element inside block" do
      assert_parsed_snapshot(<<~HTML)
        <% items.each do |item| %>
          <% if item.wrapped? %>
            <div class="item-wrapper">
          <% end %>
            <span><%= item.name %></span>
          <% if item.wrapped? %>
            </div>
          <% end %>
        <% end %>
      HTML
    end

    test "multiple sequential conditional elements" do
      assert_parsed_snapshot(<<~HTML)
        <% if @first %>
          <div class="first">
        <% end %>
          <span>First</span>
        <% if @first %>
          </div>
        <% end %>

        <% if @second %>
          <section class="second">
        <% end %>
          <span>Second</span>
        <% if @second %>
          </section>
        <% end %>
      HTML
    end

    test "complete elements inside matching if blocks should not trigger multiple tags error" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <h2>Title</h2>
            <p>Description</p>
          </div>
        <% end %>

        <% if condition %>
          <div>
            <h2>Title</h2>
            <p>Description</p>
          </div>
        <% end %>
      HTML
    end

    test "complete elements with same condition in nested scope should not trigger error" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <% if @is_owner %>
            <div class="section">
              <h2>Title</h2>
              <p>Description</p>
            </div>
          <% end %>

          <% if @is_owner %>
            <div class="section">
              <h2>Title</h2>
              <p>Description</p>
            </div>
          <% end %>
        </div>
      HTML
    end

    test "matching unless blocks with balanced tags should not trigger error" do
      assert_parsed_snapshot(<<~HTML)
        <% unless hidden %>
          <div>
            <h2>Title</h2>
          </div>
        <% end %>
        <% unless hidden %>
          <div>
            <span>Content</span>
          </div>
        <% end %>
      HTML
    end

    test "if blocks with deeply nested balanced tags should not trigger error" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
            <section>
              <h1>Title</h1>
              <p>Description</p>
            </section>
          </div>
        <% end %>
        <% if condition %>
          <div>
            <section>
              <h1>Title</h1>
              <p>Description</p>
            </section>
          </div>
        <% end %>
      HTML
    end

    test "actual unmatched multiple tags in matching conditionals" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          <div>
          <span>
        <% end %>
          content
        <% if condition %>
          </span>
          </div>
        <% end %>
      HTML
    end
  end
end
