# frozen_string_literal: true

require_relative "../../test_helper"

module Parser
  module Prism
    class PrismProgramTest < Minitest::Spec
      include SnapshotUtils

      test "expression tag with string" do
        assert_parsed_snapshot(%(<%= "hello" %>), prism_program: true)
      end

      test "expression tag with method call" do
        assert_parsed_snapshot(%(<%= user.name %>), prism_program: true)
      end

      test "expression tag with instance variable" do
        assert_parsed_snapshot(%(<%= @name %>), prism_program: true)
      end

      test "expression tag with chained method call" do
        assert_parsed_snapshot(%(<%= user.posts.count %>), prism_program: true)
      end

      test "expression tag with method call and arguments" do
        assert_parsed_snapshot(%(<%= link_to "Home", root_path %>), prism_program: true)
      end

      test "expression tag with ternary" do
        assert_parsed_snapshot(%(<%= admin? ? "Yes" : "No" %>), prism_program: true)
      end

      test "expression tag with string interpolation" do
        assert_parsed_snapshot('<%= "hello #{name}" %>', prism_program: true)
      end

      test "multiple expressions" do
        assert_parsed_snapshot(%(<%= first %><%= second %>), prism_program: true)
      end

      test "non-output tag with assignment" do
        assert_parsed_snapshot(%(<% x = 1 %>), prism_program: true)
      end

      test "non-output tag with method call" do
        assert_parsed_snapshot(%(<% render partial: "header" %>), prism_program: true)
      end

      test "if statement" do
        assert_parsed_snapshot(%(<% if true %><%= "yes" %><% end %>), prism_program: true)
      end

      test "if/else statement" do
        assert_parsed_snapshot(%(<% if admin? %><%= "admin" %><% else %><%= "user" %><% end %>), prism_program: true)
      end

      test "if/elsif/else statement" do
        assert_parsed_snapshot(%(<% if a? %>A<% elsif b? %>B<% else %>C<% end %>), prism_program: true)
      end

      test "unless statement" do
        assert_parsed_snapshot(%(<% unless hidden? %><%= content %><% end %>), prism_program: true)
      end

      test "unless/else statement" do
        assert_parsed_snapshot(%(<% unless admin? %><%= "restricted" %><% else %><%= "welcome" %><% end %>), prism_program: true)
      end

      test "each block" do
        assert_parsed_snapshot(%(<% items.each do |item| %><%= item %><% end %>), prism_program: true)
      end

      test "each_with_index block" do
        assert_parsed_snapshot(%(<% items.each_with_index do |item, index| %><%= item %><% end %>), prism_program: true)
      end

      test "map block" do
        assert_parsed_snapshot(%(<% items.map do |item| %><%= item.name %><% end %>), prism_program: true)
      end

      test "times block" do
        assert_parsed_snapshot(%(<% 3.times do |i| %><%= i %><% end %>), prism_program: true)
      end

      test "while loop" do
        assert_parsed_snapshot(%(<% while running? %><%= status %><% end %>), prism_program: true)
      end

      test "until loop" do
        assert_parsed_snapshot(%(<% until done? %><%= progress %><% end %>), prism_program: true)
      end

      test "for loop" do
        assert_parsed_snapshot(%(<% for item in items %><%= item %><% end %>), prism_program: true)
      end

      test "case/when" do
        assert_parsed_snapshot(%(<% case role %><% when "admin" %><%= "Admin" %><% when "user" %><%= "User" %><% end %>), prism_program: true)
      end

      test "case/when/else" do
        assert_parsed_snapshot(%(<% case status %><% when :active %>Active<% when :inactive %>Inactive<% else %>Unknown<% end %>), prism_program: true)
      end

      test "case/in pattern matching" do
        assert_parsed_snapshot(%(<% case data %><% in { name: } %><%= name %><% end %>), prism_program: true)
      end

      test "begin/rescue" do
        assert_parsed_snapshot(%(<% begin %><%= dangerous_call %><% rescue %><%= "error" %><% end %>), prism_program: true)
      end

      test "begin/rescue/ensure" do
        assert_parsed_snapshot(%(<% begin %><%= risky %><% rescue => e %><%= e.message %><% ensure %><%= cleanup %><% end %>), prism_program: true)
      end

      test "nested if inside each" do
        assert_parsed_snapshot(%(<% items.each do |item| %><% if item.visible? %><%= item.name %><% end %><% end %>), prism_program: true)
      end

      test "expression inside HTML" do
        assert_parsed_snapshot(%(<div class="<%= css_class %>"><%= content %></div>), prism_program: true)
      end

      test "prism_nodes and prism_program combined: if statement" do
        assert_parsed_snapshot(%(<% if true %><%= "yes" %><% end %>), prism_nodes: true, prism_program: true)
      end
    end
  end
end
