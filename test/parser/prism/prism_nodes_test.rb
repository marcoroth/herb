# frozen_string_literal: true

require_relative "../../test_helper"

module Parser
  module Prism
    class PrismNodesTest < Minitest::Spec
      include SnapshotUtils

      test "expression tag with string" do
        assert_parsed_snapshot(%(<%= "hello" %>), prism_nodes: true)
      end

      test "expression tag with String" do
        assert_parsed_snapshot(%(<%= "String" %>), prism_nodes: true)
      end

      test "expression tag with method call" do
        assert_parsed_snapshot(%(<%= user.name %>), prism_nodes: true)
      end

      test "expression tag with instance variable" do
        assert_parsed_snapshot(%(<%= @name %>), prism_nodes: true)
      end

      test "expression tag with chained method call" do
        assert_parsed_snapshot(%(<%= user.posts.count %>), prism_nodes: true)
      end

      test "expression tag with method call and arguments" do
        assert_parsed_snapshot(%(<%= link_to "Home", root_path %>), prism_nodes: true)
      end

      test "expression tag with ternary" do
        assert_parsed_snapshot(%(<%= admin? ? "Yes" : "No" %>), prism_nodes: true)
      end

      test "expression tag with arithmetic" do
        assert_parsed_snapshot(%(<%= 1 + 2 %>), prism_nodes: true)
      end

      test "expression tag with string interpolation" do
        assert_parsed_snapshot('<%= "hello #{name}" %>', prism_nodes: true)
      end

      test "non-output tag with assignment" do
        assert_parsed_snapshot(%(<% x = 1 %>), prism_nodes: true)
      end

      test "non-output tag with method call" do
        assert_parsed_snapshot(%(<% render partial: "header" %>), prism_nodes: true)
      end

      test "if statement" do
        assert_parsed_snapshot(%(<% if true %><%= "yes" %><% end %>), prism_nodes: true)
      end

      test "if/else statement" do
        assert_parsed_snapshot(%(<% if admin? %><%= "admin" %><% else %><%= "user" %><% end %>), prism_nodes: true)
      end

      test "if/elsif/else statement" do
        assert_parsed_snapshot(%(<% if a? %>A<% elsif b? %>B<% else %>C<% end %>), prism_nodes: true)
      end

      test "if with predicate method" do
        assert_parsed_snapshot(%(<% if user.admin? %><%= user.name %><% end %>), prism_nodes: true)
      end

      test "unless statement" do
        assert_parsed_snapshot(%(<% unless hidden? %><%= content %><% end %>), prism_nodes: true)
      end

      test "unless/else statement" do
        assert_parsed_snapshot(%(<% unless admin? %><%= "restricted" %><% else %><%= "welcome" %><% end %>), prism_nodes: true)
      end

      test "each block" do
        assert_parsed_snapshot(%(<% items.each do |item| %><%= item %><% end %>), prism_nodes: true)
      end

      test "each_with_index block" do
        assert_parsed_snapshot(%(<% items.each_with_index do |item, index| %><%= item %><% end %>), prism_nodes: true)
      end

      test "map block" do
        assert_parsed_snapshot(%(<% items.map do |item| %><%= item.name %><% end %>), prism_nodes: true)
      end

      test "times block" do
        assert_parsed_snapshot(%(<% 3.times do |i| %><%= i %><% end %>), prism_nodes: true)
      end

      test "while loop" do
        assert_parsed_snapshot(%(<% while running? %><%= status %><% end %>), prism_nodes: true)
      end

      test "until loop" do
        assert_parsed_snapshot(%(<% until done? %><%= progress %><% end %>), prism_nodes: true)
      end

      test "for loop" do
        assert_parsed_snapshot(%(<% for item in items %><%= item %><% end %>), prism_nodes: true)
      end

      test "case/when" do
        assert_parsed_snapshot(%(<% case role %><% when "admin" %><%= "Admin" %><% when "user" %><%= "User" %><% end %>), prism_nodes: true)
      end

      test "case/when/else" do
        assert_parsed_snapshot(%(<% case status %><% when :active %>Active<% when :inactive %>Inactive<% else %>Unknown<% end %>), prism_nodes: true)
      end

      test "case/in pattern matching" do
        assert_parsed_snapshot(%(<% case data %><% in { name: } %><%= name %><% end %>), prism_nodes: true)
      end

      test "begin/rescue" do
        assert_parsed_snapshot(%(<% begin %><%= dangerous_call %><% rescue %><%= "error" %><% end %>), prism_nodes: true)
      end

      test "begin/rescue/ensure" do
        assert_parsed_snapshot(%(<% begin %><%= risky %><% rescue => e %><%= e.message %><% ensure %><%= cleanup %><% end %>), prism_nodes: true)
      end

      test "nested if inside each" do
        assert_parsed_snapshot(%(<% items.each do |item| %><% if item.visible? %><%= item.name %><% end %><% end %>), prism_nodes: true)
      end

      test "expression inside HTML" do
        assert_parsed_snapshot(%(<div class="<%= css_class %>"><%= content %></div>), prism_nodes: true)
      end

      test "lambda block" do
        assert_parsed_snapshot(%(<%= -> { "hello" }.call %>), prism_nodes: true)
      end
    end
  end
end
