# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class EscapeTest < Minitest::Spec
    include SnapshotUtils

    test "escaped erb tag" do
      assert_parsed_snapshot("<%% 'Test' %%>")
    end

    test "escaped erb output tag" do
      assert_parsed_snapshot("<%%= 'Test' %%>")
    end

    test "escaped erb output tag with block" do
      assert_parsed_snapshot("<%%= tag.div do %>\n  Hello\n<% end %>")
      assert_parsed_snapshot("<%%= tag.div do %>\n  Hello\n<%% end %>")
    end

    test "escaped erb tag with block" do
      assert_parsed_snapshot("<%% [1, 2, 3].each do |item| %>\n  Hello\n<% end %>")
      assert_parsed_snapshot("<%% [1, 2, 3].each do |item| %>\n  Hello\n<%% end %>")
    end
  end
end
