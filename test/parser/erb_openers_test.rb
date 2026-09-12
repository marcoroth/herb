# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBOpenersTest < Minitest::Spec
    include SnapshotUtils

    test "no openers are configured by default" do
      assert_parsed_snapshot(%(<%graphql query { users { id } } %>))
    end

    test "a configured word opener is recognized" do
      assert_parsed_snapshot(%(<%herb slot :header %>), erb_openers: ["herb"])
    end

    test "a configured word opener requires a word boundary" do
      assert_parsed_snapshot(%(<%herbal_tea %>), erb_openers: ["herb"])
    end

    test "a configured symbol opener does not require a word boundary" do
      assert_parsed_snapshot(%(<%?maybe %>), erb_openers: ["?"])
    end

    test "an opener that is not configured is parsed as Ruby" do
      assert_parsed_snapshot(%(<%graphql query %>), erb_openers: ["herb"])
    end

    test "several openers can be configured at once" do
      assert_parsed_snapshot(<<~HTML, erb_openers: ["graphql", "herb", "?"])
        <%graphql query { id } %>
        <%herb slot :header %>
        <%? maybe %>
        <%= name %>
      HTML
    end

    test "an empty opener list leaves every tag as Ruby" do
      assert_parsed_snapshot(%(<%graphql query %>), erb_openers: [])
    end

    test "a configured opener does not shadow a built-in opening" do
      assert_parsed_snapshot(%(<%== value %>), erb_openers: ["="])
    end
  end
end
