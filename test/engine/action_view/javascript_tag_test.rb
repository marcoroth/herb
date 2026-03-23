# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class JavascriptTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "javascript_tag with content" do
        assert_action_view_helper("<%= javascript_tag \"alert('Hello')\" %>")
      end

      test "javascript_tag with block" do
        assert_action_view_helper(<<~ERB)
          <%= javascript_tag do %>
            alert('Hello')
          <% end %>
        ERB
      end

      test "javascript_tag with type attribute" do
        assert_action_view_helper('<%= javascript_tag "alert(\'Hello\')", type: "application/javascript" %>')
      end
    end
  end
end
