# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class GraphQLTest < Minitest::Spec
    include SnapshotUtils

    test "graphql tag" do
      assert_parsed_snapshot(<<~HTML)
        <%graphql
          fragment HumanFragment on Human {
            name
            homePlanet
          }
        %>
      HTML
    end

    test "graphql tag with comment and html" do
      assert_parsed_snapshot(<<~HTML)
        <%# app/views/humans/human.html.erb %>
        <%graphql
          fragment HumanFragment on Human {
            name
            homePlanet
          }
        %>

        <p><%= human.name %> lives on <%= human.home_planet %>.</p>
      HTML
    end

    test "graphql tag inline" do
      assert_parsed_snapshot(%(<%graphql query { users { id } } %>))
    end

    test "graphql tag with query variables" do
      assert_parsed_snapshot(<<~HTML)
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
      HTML
    end

    test "erb tag with graphql variable is not a graphql tag" do
      assert_parsed_snapshot(%(<% graphql = "query" %>))
    end
  end
end
