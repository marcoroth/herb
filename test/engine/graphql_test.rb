# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class GraphQLTest < Minitest::Spec
    include SnapshotUtils

    test "graphql tag is omitted from compilation" do
      template = <<~ERB
        <%graphql
          fragment HumanFragment on Human {
            name
            homePlanet
          }
        %>
      ERB

      assert_compiled_snapshot(template)
    end

    test "graphql tag inline is omitted from compilation" do
      template = %(<%graphql query { users { id } } %>)

      assert_compiled_snapshot(template)
    end

    test "graphql tag with surrounding html" do
      template = <<~ERB
        <div>
          <%graphql
            fragment UserFragment on User {
              id
              email
            }
          %>
          <p>Hello <%= user.name %></p>
        </div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "graphql tag with comment and html" do
      template = <<~ERB
        <%# app/views/humans/human.html.erb %>
        <%graphql
          fragment HumanFragment on Human {
            name
            homePlanet
          }
        %>

        <p><%= human.name %> lives on <%= human.home_planet %>.</p>
      ERB

      assert_compiled_snapshot(template)
    end

    test "graphql tag with query variables" do
      template = <<~ERB
        <%graphql
          query Products($first: Int!) {
            products(first: $first) {
              nodes {
                id
                title
              }
            }
          }
        %>
        <ul>
          <% products.each do |product| %>
            <li><%= product.title %></li>
          <% end %>
        </ul>
      ERB

      assert_compiled_snapshot(template)
    end

    test "graphql variable assignment is not omitted" do
      template = %(<% graphql = "query" %>)

      assert_compiled_snapshot(template)
    end

    test "graphql tag evaluated produces empty output" do
      template = <<~ERB
        <%graphql
          fragment TestFragment on Test {
            id
          }
        %>
      ERB

      assert_evaluated_snapshot(template)
    end

    test "graphql tag with html evaluated" do
      template = <<~ERB
        <%graphql
          fragment UserFragment on User {
            name
          }
        %>
        <p>Hello World</p>
      ERB

      assert_evaluated_snapshot(template)
    end
  end
end
