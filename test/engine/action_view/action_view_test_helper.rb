# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/action_view_renderer"

module Engine
  module ActionViewTestHelper
    include SnapshotUtils

    private

    def assert_action_view_helper(template, locals = {}, evaluate: true)
      assert_compiled_snapshot(template, action_view_helpers: true)

      if evaluate
        assert_action_view_evaluated_snapshot(template, locals)
      end

      assert_action_view_match(template)
    end

    def assert_action_view_helper_mismatch(template, locals = {}, evaluate: true)
      assert_compiled_snapshot(template, action_view_helpers: true)

      if evaluate
        assert_action_view_evaluated_snapshot(template, locals)
      end

      engine = Herb::Engine.new(template, escape: false, action_view_helpers: true)
      herb_result = action_view_eval(engine.src, locals).strip
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

    def assert_action_view_match(template, locals = {})
      engine = Herb::Engine.new(template, escape: false, action_view_helpers: true)
      herb_result = action_view_eval(engine.src, locals).strip
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

    def assert_action_view_evaluated_snapshot(template, locals = {})
      engine = Herb::Engine.new(template, escape: false, action_view_helpers: true)

      result = action_view_eval(engine.src, locals)

      snapshot_key = {
        source: template,
        locals: locals,
        options: { action_view_helpers: true },
      }.to_s

      assert_snapshot_matches(result, snapshot_key)
    end

    def action_view_eval(compiled_source, locals = {})
      context = action_view_context

      locals.each do |key, value|
        name = key.to_s

        if name.start_with?("@")
          context.instance_variable_set(name, value)
        else
          context.define_singleton_method(name) { value }
        end
      end

      context.instance_eval(compiled_source)
    end

    def action_view_context
      @action_view_context ||= begin
        lookup_context = ::ActionView::LookupContext.new([])
        view = ::ActionView::Base.with_empty_template_cache.new(lookup_context, {}, nil)
        view.class.include(Turbo::FramesHelper) if defined?(Turbo::FramesHelper)
        view
      end
    end

    def render_with_action_view(template)
      Herb::ActionViewRenderer.render(template.strip)
    end
  end
end
