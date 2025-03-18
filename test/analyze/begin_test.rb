# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class BeginTest < Minitest::Spec
    include SnapshotUtils

    test "single-line begin" do
      assert_parsed_snapshot(<<~HTML)
        <% begin; end; %>
      HTML
    end

    test "begin statement" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% end %>
      HTML
    end

    test "begin statement wrapped in element" do
      assert_parsed_snapshot(<<~HTML)
        <h1>
          <% begin %>
            begin
          <% end %>
        </h1>
      HTML
    end

    test "begin with rescue" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% rescue %>
          rescue
        <% end %>
      HTML
    end

    test "begin with ensure" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% ensure %>
          ensure
        <% end %>
      HTML
    end

    test "begin with else" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% else %>
          else
        <% end %>
      HTML
    end

    test "begin with rescue and else" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% rescue %>
          rescue
        <% else %>
          else
        <% end %>
      HTML
    end

    test "begin with rescue and ensure" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% rescue %>
          rescue
        <% ensure %>
          ensure
        <% end %>
      HTML
    end

    test "begin with multiple rescues" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% rescue StandardError %>
          StandardError
        <% rescue ArgumentError %>
          ArgumentError
        <% else %>
          else
        <% end %>
      HTML
    end

    test "begin with rescue, ensure, and else" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          begin
        <% rescue %>
          rescue
        <% else %>
          else
        <% ensure %>
          ensure
        <% end %>
      HTML
    end

    test "nested begin statements" do
      assert_parsed_snapshot(<<~HTML)
        <% begin %>
          Level 1

          <% begin %>
            Level 2
          <% end %>
        <% end %>
      HTML
    end
  end
end
