# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"

module Engine
  class HeredocTest < Minitest::Spec
    include SnapshotUtils

    test "heredoc in code tag" do
      template = <<~ERB
        <%
          text = <<~TEXT
            Hello, world!
          TEXT
        %>
        <%= text %>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false })
    end
  end
end
