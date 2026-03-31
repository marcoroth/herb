# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class PostfixConditionalTest < Minitest::Spec
    include SnapshotUtils

    test "string literal with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 'aria-current=page' if selected %>
      HTML
    end

    test "string literal with postfix unless" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 'text' unless hidden? %>
      HTML
    end

    test "symbol with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= :active if selected %>
      HTML
    end

    test "variable with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= hello if condition? %>
      HTML
    end

    test "method call with postfix unless" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= complex_method(arg) unless disabled? %>
      HTML
    end

    test "no postfix remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 'text' %>
      HTML
    end

    test "non-output tag remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <% something if condition %>
      HTML
    end

    test "inside open tag context" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <a href="/" <%= 'aria-current=page' if selected %>>About</a>
      HTML
    end

    test "block if remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= if condition then 'yes' end %>
      HTML
    end

    test "ternary remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= condition ? 'yes' : 'no' %>
      HTML
    end

    test "multiple statements remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= x = 1; x if condition %>
      HTML
    end

    test "postfix with complex body expression" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= render(partial: 'header') if show_header? %>
      HTML
    end

    test "postfix with string interpolation" do
      assert_parsed_snapshot(<<~'HTML', transform_conditionals: true)
        <%= "hello #{name}" if greeting? %>
      HTML
    end

    test "inside attribute value" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div class="<%= 'active' if selected %>">content</div>
      HTML
    end

    test "method chain with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= user.name.upcase if user.present? %>
      HTML
    end

    test "compound condition with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 'admin' if user.admin? && user.active? %>
      HTML
    end

    test "multiple postfix tags in document" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 'first' if show_first? %>
        <%= 'second' unless hide_second? %>
      HTML
    end

    test "postfix inside html element body" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <div><%= 'text' if visible? %></div>
      HTML
    end

    test "erb comment remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%# 'text' if condition %>
      HTML
    end

    test "escaped erb tag remains unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%%= 'text' if condition %>
      HTML
    end

    test "numeric literal with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 42 if show_count? %>
      HTML
    end

    test "array literal with postfix if" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= [1, 2, 3] if show_list? %>
      HTML
    end

    test "hash literal with postfix unless" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= { key: 'value' } unless empty? %>
      HTML
    end

    test "postfix with negated condition" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: true)
        <%= 'text' if !hidden %>
      HTML
    end

    test "option disabled leaves postfix unchanged" do
      assert_parsed_snapshot(<<~HTML, transform_conditionals: false)
        <%= 'text' if condition %>
      HTML
    end
  end
end
