# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class IterationBlockTest < Minitest::Spec
    include SnapshotUtils

    test "each block is an ERBBlockNode when iteration_nodes is disabled" do
      assert_parsed_snapshot(<<~HTML)
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with instance variable receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with local variable receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with method call receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% current_user.posts.each do |post| %>
          <%= post.title %>
        <% end %>
      HTML
    end

    test "each block with array literal receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% [1, 2, 3].each do |number| %>
          <%= number %>
        <% end %>
      HTML
    end

    test "each block with range receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% (1..5).each do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "each block with chained receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.sort.reverse.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with safe navigation operator" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users&.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with constant receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% User::ROLES.each do |role| %>
          <%= role %>
        <% end %>
      HTML
    end

    test "each block without block parameters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do %>
          <p>user</p>
        <% end %>
      HTML
    end

    test "each block with multiple block parameters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @pairs.each do |key, value| %>
          <%= key %>: <%= value %>
        <% end %>
      HTML
    end

    test "each block with destructured block parameters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @pairs.each do |(key, value)| %>
          <%= key %>: <%= value %>
        <% end %>
      HTML
    end

    test "each block with nested destructured block parameters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @rows.each do |(first, (second, third))| %>
          <%= first %><%= second %><%= third %>
        <% end %>
      HTML
    end

    test "each block with splat inside destructured block parameters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @rows.each do |(head, *tail)| %>
          <%= head %><%= tail %>
        <% end %>
      HTML
    end

    test "each block with post-rest block parameter" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @rows.each do |first, *middle, last| %>
          <%= first %><%= middle %><%= last %>
        <% end %>
      HTML
    end

    test "each block with optional block parameter default" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, count = 5| %>
          <%= count %>
        <% end %>
      HTML
    end

    test "each block with string literal block parameter default" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, label = "n/a"| %>
          <%= label %>
        <% end %>
      HTML
    end

    test "each block with expression block parameter default" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, total = (item.size * 2)| %>
          <%= total %>
        <% end %>
      HTML
    end

    test "each block with keyword block parameter default" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, index: 0| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "each block with required keyword block parameter" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, index:| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "each block with keyword rest block parameter" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, **options| %>
          <%= options %>
        <% end %>
      HTML
    end

    test "each block with block parameter" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @items.each do |item, &callback| %>
          <%= item %>
        <% end %>
      HTML
    end

    test "each block with splat block parameter" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @rows.each do |*columns| %>
          <%= columns.join %>
        <% end %>
      HTML
    end

    test "each block with brace block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each { |user| %>
          <%= user.id %>
        <% } %>
      HTML
    end

    test "each block as an output tag" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <%= @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block inside an HTML element" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <ul>
          <% @users.each do |user| %>
            <li><%= user.name %></li>
          <% end %>
        </ul>
      HTML
    end

    test "nested each blocks" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @groups.each do |group| %>
          <% group.users.each do |user| %>
            <%= user.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block containing an if statement" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <% if user.admin? %>
            <%= user.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block inside an if statement" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% if @users.any? %>
          <% @users.each do |user| %>
            <%= user.name %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block with rescue clause" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <%= user.name %>
        <% rescue %>
          <p>error</p>
        <% end %>
      HTML
    end

    test "each block with ensure clause" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <%= user.name %>
        <% ensure %>
          <p>done</p>
        <% end %>
      HTML
    end

    test "each block used in an attribute value is not transformed" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <div class="<% @classes.each do |klass| %><%= klass %><% end %>"></div>
      HTML
    end

    test "each block with unicode content" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @emojis.each do |emoji| %>
          <%= emoji %> — ✨
        <% end %>
      HTML
    end

    test "each block preceded by multi-byte characters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <p>✨ Grüße — 日本語</p>
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block with multi-byte characters in the receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% ["✨", "日本語"].each do |emoji| %>
          <%= emoji %>
        <% end %>
      HTML
    end

    test "each_with_index block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each_with_index do |user, index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "each_with_object block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each_with_object({}) do |user, hash| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each_slice block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each_slice(3) do |group| %>
          <%= group.size %>
        <% end %>
      HTML
    end

    test "times block with integer literal receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% 10.times do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "times block with method call receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @page.per_page.times do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "upto block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% 1.upto(5) do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "downto block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% 5.downto(1) do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "step block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% 0.step(10, 2) do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "map block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.map do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "select block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.select do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "cycle block" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% %w[odd even].cycle do |parity| %>
          <%= parity %>
        <% end %>
      HTML
    end

    test "each_cons block with argument" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each_cons(2) do |a, b| %>
          <%= a %><%= b %>
        <% end %>
      HTML
    end

    test "iteration block with multiple call arguments" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% 0.step(@limit, 2) do |index| %>
          <%= index %>
        <% end %>
      HTML
    end

    test "builder block without a receiver is not transformed" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% form_with model: @user do |form| %>
          <%= form.text_field :name %>
        <% end %>
      HTML
    end

    test "non-iteration method with a receiver is not transformed" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @user.tap do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each without a receiver is not transformed" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% each do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each assigned to a variable is not transformed" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% result = @users.each do |user| %>
          <%= user %>
        <% end %>
      HTML
    end

    test "each block combined with render nodes" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true, render_nodes: true)
        <% @users.each do |user| %>
          <%= render "user", user: user %>
        <% end %>
      HTML
    end

    test "each block combined with action view helpers" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true, action_view_helpers: true)
        <% @users.each do |user| %>
          <%= link_to "Profile", user_path(user) %>
        <% end %>
      HTML
    end

    test "each block wrapping a conditional open tag" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <% if user.admin? %><div class="admin"><% else %><div><% end %>
            <%= user.name %>
          </div>
        <% end %>
      HTML
    end

    test "break inside an each block is valid" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <% break if user.nil? %>
        <% end %>
      HTML
    end

    test "each block missing its end tag" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <%= user.name %>
      HTML
    end

    test "each block with mismatched HTML inside" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %>
          <div><span></div>
        <% end %>
      HTML
    end

    test "iteration nodes are not transformed when analyze is disabled" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true, analyze: false)
        <% @users.each do |user| %>
          <%= user.id %>
        <% end %>
      HTML
    end

    test "each block in an ERB comment is not transformed" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <%# @users.each do |user| %>
      HTML
    end

    test "each block with trim tags" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <%- @users.each do |user| -%>
          <%= user.id %>
        <%- end -%>
      HTML
    end

    test "each block with a receiver containing a do keyword in a string" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% "do end".chars.each do |char| %>
          <%= char %>
        <% end %>
      HTML
    end

    test "each block with an inline brace block in the receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.map { |user| user.name }.each do |name| %>
          <%= name %>
        <% end %>
      HTML
    end

    test "each block with a hash literal receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% { a: 1, b: 2 }.each do |key, value| %>
          <%= key %>: <%= value %>
        <% end %>
      HTML
    end

    test "each block with a multi-line receiver" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% [
             1,
             2
           ].each do |number| %>
          <%= number %>
        <% end %>
      HTML
    end

    test "each block using the implicit it parameter" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do %>
          <%= it %>
        <% end %>
      HTML
    end

    test "each block with anonymous block parameters" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |first, *, **, &| %>
          <%= first %>
        <% end %>
      HTML
    end

    test "each block with every parameter kind at once" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @rows.each do |a, b = 1, *c, d, e:, f: 2, **g, &h| %>
          <%= a %>
        <% end %>
      HTML
    end

    test "deeply nested each blocks" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% a.each do |x| %>
          <% x.b.each do |y| %>
            <% y.c.each do |z| %>
              <%= z %>
            <% end %>
          <% end %>
        <% end %>
      HTML
    end

    test "each block with an empty body" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true)
        <% @users.each do |user| %><% end %>
      HTML
    end

    test "each block combined with strict locals" do
      assert_parsed_snapshot(<<~HTML, iteration_nodes: true, strict_locals: true)
        <%# locals: (users:) %>
        <% users.each do |user| %>
          <%= user %>
        <% end %>
      HTML
    end
  end
end
