# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class ERBOpenersTest < Minitest::Spec
    include SnapshotUtils

    test "a configured opener is omitted from compilation" do
      template = %(<%herb slot :header %>)

      assert_compiled_snapshot(template, parser_options: { erb_openers: ["herb"] })
    end

    test "a tag that only shares a prefix with a configured opener is compiled as Ruby" do
      template = %(<%herbal_tea %>)

      assert_compiled_snapshot(template, parser_options: { erb_openers: ["herb"] })
    end

    test "graphql is compiled as Ruby when it is not configured" do
      template = %(<%graphql_query %>)

      assert_compiled_snapshot(template, parser_options: { erb_openers: ["herb"] })
    end

    test "several configured openers are omitted from compilation" do
      template = <<~ERB
        <%graphql query { id } %>
        <%herb slot :header %>
        <p><%= name %></p>
      ERB

      assert_compiled_snapshot(template, parser_options: { erb_openers: ["graphql", "herb"] })
    end
  end
end
