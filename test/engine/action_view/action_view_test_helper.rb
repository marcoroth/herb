# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/action_view_renderer"

module Engine
  module ActionViewTestHelper
    include SnapshotUtils

    private

    def assert_action_view_helper(template, locals = {})
      assert_compiled_snapshot(template, action_view_helpers: true)
      assert_evaluated_snapshot(template, locals, action_view_helpers: true)
      assert_action_view_match(template)
    end

    def assert_action_view_helper_mismatch(template, locals = {})
      assert_compiled_snapshot(template, action_view_helpers: true)
      assert_evaluated_snapshot(template, locals, action_view_helpers: true)

      engine = Herb::Engine.new(template, escape: false, action_view_helpers: true)
      herb_result = eval(engine.src).strip
      rails_result = render_with_action_view(template).strip

      herb_snapshot_key = { source: template, type: "herb_output", action_view_helpers: true }.to_s
      rails_snapshot_key = { source: template, type: "rails_output", action_view_helpers: true }.to_s

      assert_snapshot_matches(herb_result, herb_snapshot_key)
      assert_snapshot_matches(rails_result, rails_snapshot_key)

      refute_equal herb_result, rails_result, <<~MESSAGE
        Expected Herb and Rails outputs to differ, but they match:
          #{herb_result}
      MESSAGE
    end

    def assert_action_view_match(template)
      engine = Herb::Engine.new(template, escape: false, action_view_helpers: true)
      herb_result = eval(engine.src).strip
      rails_result = render_with_action_view(template).strip

      assert_equal rails_result, herb_result, <<~MESSAGE
        Herb output does not match Rails output for template:
        #{template.strip}

        Rails:
          #{rails_result}

        Herb:
          #{herb_result}

        Compiled Ruby:
          #{engine.src}
      MESSAGE
    end

    def render_with_action_view(template)
      Herb::ActionViewRenderer.render(template.strip)
    end
  end
end
