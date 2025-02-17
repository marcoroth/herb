# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBTest < Minitest::Spec
    include SnapshotUtils

    test "empty" do
      assert_parsed_snapshot("<% hello %>")
    end
  end
end
