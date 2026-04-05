# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class TernaryConditionalTest < Minitest::Spec
    include SnapshotUtils

    test "simple ternary" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= condition ? 'yes' : 'no' %>
      HTML
    end

    test "ternary with method calls" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= user.active? ? 'active' : 'inactive' %>
      HTML
    end

    test "ternary inside html element" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div><%= cond ? 'a' : 'b' %></div>
      HTML
    end

    test "ternary inside attribute value" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div class="<%= cond ? 'a' : 'b' %>">content</div>
      HTML
    end

    test "ternary inside open tag" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <a <%= cond ? 'aria-current=page' : '' %>>
      HTML
    end

    test "ternary inside attribute value with static prefix" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div class="container <%= cond ? 'active' : 'inactive' %>">content</div>
      HTML
    end

    test "ternary inside attribute value with static suffix" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div class="<%= cond ? 'text' : 'hidden' %> mb-4">content</div>
      HTML
    end

    test "ternary inside attribute value with static prefix and suffix" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div class="container <%= cond ? 'active' : 'inactive' %> mb-4">content</div>
      HTML
    end

    test "multiple ternaries in document" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= first ? 'a' : 'b' %>
        <%= second ? 'c' : 'd' %>
      HTML
    end

    test "ternary with string interpolation" do
      assert_parsed_snapshot(<<~'HTML', transform_conditionals: true)
        <%= cond ? "hello #{name}" : "goodbye" %>
      HTML
    end

    test "ternary with numeric values" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= active ? 1 : 0 %>
      HTML
    end

    test "ternary with nil false branch" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= cond ? 'value' : nil %>
      HTML
    end

    test "ternary with compound condition" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= user.admin? && user.active? ? 'admin' : 'user' %>
      HTML
    end

    test "non-output tag with ternary remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <% x = cond ? 'yes' : 'no' %>
      HTML
    end

    test "ternary with transform_conditionals disabled" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: false)
        <%= condition ? 'yes' : 'no' %>
      HTML
    end
  end
end
