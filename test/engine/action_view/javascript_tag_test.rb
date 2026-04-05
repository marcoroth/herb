# frozen_string_literal: true

require_relative "action_view_test_helper"

module Engine
  module ActionView
    class JavascriptTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "javascript_tag with content" do
        assert_precompiled_snapshot("<%= javascript_tag \"alert('Hello')\" %>")
      end

      test "javascript_tag with block" do
        assert_precompiled_snapshot(<<~ERB)
          <%= javascript_tag do %>
            alert('Hello')
          <% end %>
        ERB
      end

      test "javascript_tag with type attribute" do
        assert_precompiled_snapshot('<%= javascript_tag "alert(\'Hello\')", type: "application/javascript" %>')
      end

      # TODO: content_security_policy_nonce is not available without Rails CSP setup
      test "javascript_tag with nonce true" do
        assert_precompiled_snapshot(<<~ERB, evaluate: false)
          <%= javascript_tag nonce: true do %>
            alert('Hello')
          <% end %>
        ERB
      end

      test "javascript_tag with nonce false" do
        assert_precompiled_snapshot(<<~ERB)
          <%= javascript_tag nonce: false do %>
            alert('Hello')
          <% end %>
        ERB
      end
    end
  end
end
