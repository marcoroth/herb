# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class ThenTest < Minitest::Spec
    include SnapshotUtils

    test "if with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition then %>
          content
        <% end %>
      HTML
    end

    test "if with then keyword inline" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition then do_something %>
      HTML
    end

    test "unless with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% unless condition then %>
          content
        <% end %>
      HTML
    end

    test "unless with then keyword inline" do
      assert_parsed_snapshot(<<~HTML)
        <% unless condition then do_something %>
      HTML
    end

    test "case when with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String then %>
          String
        <% end %>
      HTML
    end

    test "case when with then keyword inline" do
      assert_parsed_snapshot(<<~HTML)
        <% case variable %>
        <% when String then "string" %>
        <% when Integer then "integer" %>
        <% end %>
      HTML
    end

    test "case when with then keyword and expression" do
      assert_parsed_snapshot(<<~HTML)
        <% header_error = case %>
        <% when header.blank? then t(".required") %>
        <% when @form.headers.count(header) > 1 then t(".duplicate") %>
        <% end %>
      HTML
    end

    test "case when with multiple then keywords" do
      assert_parsed_snapshot(<<~HTML)
        <% case status %>
        <% when :active then %>
          Active
        <% when :pending then %>
          Pending
        <% when :inactive then %>
          Inactive
        <% end %>
      HTML
    end

    test "nested if with then inside case when" do
      assert_parsed_snapshot(<<~HTML)
        <% case type %>
        <% when :admin then %>
          <% if logged_in? then %>
            Admin Panel
          <% end %>
        <% end %>
      HTML
    end

    test "output tag with if then" do
      assert_parsed_snapshot(<<~HTML)
        <%= if condition then "yes" else "no" end %>
      HTML
    end

    test "output tag with case when then" do
      assert_parsed_snapshot(<<~HTML)
        <%= case x; when 1 then "one"; when 2 then "two"; end %>
      HTML
    end

    test "elsif with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% if a then %>
          A
        <% elsif b then %>
          B
        <% elsif c then %>
          C
        <% end %>
      HTML
    end

    test "if else with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition then %>
          yes
        <% else %>
          no
        <% end %>
      HTML
    end

    test "unless else with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% unless condition then %>
          no
        <% else %>
          yes
        <% end %>
      HTML
    end

    test "case in pattern matching with then keyword" do
      assert_parsed_snapshot(<<~HTML)
        <% case [1, 2] %>
        <% in [a, b] then %>
          matched
        <% end %>
      HTML
    end

    test "case in pattern matching with then keyword inline" do
      assert_parsed_snapshot(<<~HTML)
        <% case value %>
        <% in Integer then "integer" %>
        <% in String then "string" %>
        <% end %>
      HTML
    end

    test "case in pattern matching with complex pattern and then" do
      assert_parsed_snapshot(<<~HTML)
        <% case data %>
        <% in { name:, age: } then %>
          <%= name %> is <%= age %> years old
        <% in [first, *rest] then %>
          First: <%= first %>
        <% end %>
      HTML
    end

    test "mixed when clauses with and without then" do
      assert_parsed_snapshot(<<~HTML)
        <% case value %>
        <% when 1 then %>
          one
        <% when 2 %>
          two
        <% when 3 then %>
          three
        <% end %>
      HTML
    end

    test "then keyword appearing in string content" do
      assert_parsed_snapshot(<<~HTML)
        <% if condition %>
          then this happens
        <% end %>
      HTML
    end

    test "then keyword appearing in comment" do
      assert_parsed_snapshot(<<~HTML)
        <%# if something then do that %>
        <% if condition %>
          content
        <% end %>
      HTML
    end

    test "then as method name" do
      assert_parsed_snapshot(<<~HTML)
        <% promise.then { |value| value * 2 } %>
      HTML
    end

    test "variable named then_value" do
      assert_parsed_snapshot(<<~HTML)
        <% if then_value %>
          has then in variable name
        <% end %>
      HTML
    end

    test "deeply nested if with then" do
      assert_parsed_snapshot(<<~HTML)
        <% if a then %>
          <% if b then %>
            <% if c then %>
              deeply nested
            <% end %>
          <% end %>
        <% end %>
      HTML
    end

    test "case when then with else clause" do
      assert_parsed_snapshot(<<~HTML)
        <% case status %>
        <% when :ok then %>
          success
        <% when :error then %>
          failure
        <% else %>
          unknown
        <% end %>
      HTML
    end

    test "if then with ternary inside" do
      assert_parsed_snapshot(<<~HTML)
        <% if show then %>
          <%= active ? "yes" : "no" %>
        <% end %>
      HTML
    end

    test "when with then and method chain" do
      assert_parsed_snapshot(<<~HTML)
        <% case items.first.type %>
        <% when :foo then %>
          foo
        <% when :bar then %>
          bar
        <% end %>
      HTML
    end

    test "if then with block" do
      assert_parsed_snapshot(<<~HTML)
        <% if items.any? then %>
          <% items.each do |item| %>
            <%= item.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "multiple then on same line in output tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= if a then (if b then "ab" else "a" end) else "none" end %>
      HTML
    end

    test "when then with regex condition" do
      assert_parsed_snapshot(<<~HTML)
        <% case text %>
        <% when /^hello/ then %>
          greeting
        <% when /^bye/ then %>
          farewell
        <% end %>
      HTML
    end

    test "when then with range condition" do
      assert_parsed_snapshot(<<~HTML)
        <% case age %>
        <% when 0..12 then %>
          child
        <% when 13..19 then %>
          teenager
        <% when 20..64 then %>
          adult
        <% else %>
          senior
        <% end %>
      HTML
    end
  end
end
