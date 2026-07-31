# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class EachBlockTest < Minitest::Spec
    include SnapshotUtils

    test "each block is an ERBBlockNode when each_nodes is disabled" do
      assert_parsed_snapshot(<<~HTML)
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with instance variable receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with local variable receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with method call receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% current_user.posts.each do |post| %>
          <%= post.title %>
        <% end %>
      HTML
    end

    test "each block with array literal receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% [1, 2, 3].each do |number| %>
          <%= number %>
        <% end %>
      HTML
    end

    test "each block with range receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% (1..5).each do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "each block with chained receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.sort.reverse.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with safe navigation operator" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users&.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with constant receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% User::ROLES.each do |role| %>
          <%= role %>
        <% end %>
      HTML
    end

    test "each block without block parameters" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do %>
          <p>user</p>
        <% end %>
      HTML
    end

    test "each block with multiple block parameters" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @pairs.each do |key, value| %>
          <%= key %>: <%= value %>
        <% end %>
      HTML
    end

    test "each block with destructured block parameters" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @pairs.each do |(key, value)| %>
          <%= key %>: <%= value %>
        <% end %>
      HTML
    end

    test "each block with splat block parameter" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @rows.each do |*columns| %>
          <%= columns.join %>
        <% end %>
      HTML
    end

    test "each block with brace block" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each { |user| %>
          <%= user.id %>
        <% } %>
      HTML
    end

    test "each block as an output tag" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <%= @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block inside an HTML element" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <ul>
          <% @users.each do |user| %>
            <li><%= user.name %></li>
          <% end %>
        </ul>
      HTML
    end

    test "nested each blocks" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @groups.each do |group| %>
          <% group.users.each do |user| %>
            <%= user.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block containing an if statement" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <% if user.admin? %>
            <%= user.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block inside an if statement" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% if @users.any? %>
          <% @users.each do |user| %>
            <%= user.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block with rescue clause" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <%= user.name %>
        <% rescue %>
          <p>error</p>
        <% end %>
      HTML
    end

    test "each block with ensure clause" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <%= user.name %>
        <% ensure %>
          <p>done</p>
        <% end %>
      HTML
    end

    # Attribute values aren't reached by the specialization passes, so this stays an ERBBlockNode.
    # This matches how `render_nodes` behaves for a render block in an attribute value.
    test "each block used in an attribute value is not transformed" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <div class="<% @classes.each do |klass| %><%= klass %><% end %>"></div>
      HTML
    end

    test "each block with unicode content" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @emojis.each do |emoji| %>
          <%= emoji %> — ✨
        <% end %>
      HTML
    end

    test "each block preceded by multi-byte characters" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <p>✨ Grüße — 日本語</p>
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with multi-byte characters in the receiver" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% ["✨", "日本語"].each do |emoji| %>
          <%= emoji %>
        <% end %>
      HTML
    end

    test "each_with_index is not transformed" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each_with_index do |user, index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "each_with_object is not transformed" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each_with_object({}) do |user, hash| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "map is not transformed" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.map do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each without a receiver is not transformed" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% each do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each assigned to a variable is not transformed" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% result = @users.each do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each block combined with render nodes" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true, render_nodes: true)
        <% @users.each do |user| %>
          <%= render "user", user: user %>
        <% end %>
      HTML
    end

    test "each block combined with action view helpers" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true, action_view_helpers: true)
        <% @users.each do |user| %>
          <%= link_to "Profile", user_path(user) %>
        <% end %>
      HTML
    end

    test "each block wrapping a conditional open tag" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <% if user.admin? %><div class="admin"><% else %><div><% end %>
            <%= user.name %>
          </div>
        <% end %>
      HTML
    end

    test "break inside an each block is valid" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <% break if user.nil? %>
        <% end %>
      HTML
    end

    test "each block missing its end tag" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <%= user.name %>
      HTML
    end

    test "each block with mismatched HTML inside" do
      assert_parsed_snapshot(<<~HTML, each_nodes: true)
        <% @users.each do |user| %>
          <div><span></div>
        <% end %>
      HTML
    end
  end
end
