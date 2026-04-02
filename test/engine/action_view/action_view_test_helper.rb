# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../action_view_renderer"

module Engine
  module ActionViewTestHelper
    include SnapshotUtils

    private

    def assert_precompiled_snapshot(template, locals = {}, evaluate: true)
      options = { precompile: true }
      options[:locals] = locals unless locals.empty?

      assert_compiled_snapshot(template, options)

      return unless evaluate

      assert_precompiled_evaluated_snapshot(template, locals)
      assert_precompiled_output_match(template, locals)
    end

    def assert_precompiled_mismatch_snapshot(template, locals = {}, evaluate: true)
      assert_compiled_snapshot(template, precompile: true)

      if evaluate
        assert_precompiled_evaluated_snapshot(template, locals)
      end

      engine = Herb::Engine.new(template, escape: false, precompile: true)
      herb_result = action_view_eval(engine.src, locals).strip
      rails_result = render_with_action_view(template, locals).strip

      herb_snapshot_key = { source: template, type: "herb_output", action_view_helpers: true }.to_s
      rails_snapshot_key = { source: template, type: "rails_output", action_view_helpers: true }.to_s

      assert_snapshot_matches(herb_result, herb_snapshot_key)
      assert_snapshot_matches(rails_result, rails_snapshot_key)

      refute_equal herb_result, rails_result, <<~MESSAGE
        Expected Herb and Rails outputs to differ, but they match:
          #{herb_result}
      MESSAGE
    end

    def assert_precompiled_output_match(template, locals = {})
      precompiled_engine = Herb::Engine.new(template, escape: false, precompile: true)

      erubi_result = render_with_action_view(template, locals).strip
      herb_precompiled_result = action_view_eval(precompiled_engine.src, locals).strip

      assert_equal erubi_result, herb_precompiled_result, <<~MESSAGE
        Herb (precompiled) output does not match Rails output for template:
        #{template.strip}

        Rails (Erubi via ActionView):
          #{erubi_result}

        Herb (precompiled via ActionView):
          #{herb_precompiled_result}

        Compiled Ruby:
          #{precompiled_engine.src}
      MESSAGE
    end

    def assert_precompiled_evaluated_snapshot(template, locals = {})
      engine = Herb::Engine.new(template, escape: false, precompile: true)

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

    module SimpleUrlFor
      def url_for(options = {})
        case options
        when String then options
        when Symbol, Hash then super
        else options.to_s
        end
      end
    end

    def action_view_context
      @action_view_context ||= begin
        lookup_context = ::ActionView::LookupContext.new([])
        view = ::ActionView::Base.with_empty_template_cache.new(lookup_context, {}, nil)
        view.class.include(Turbo::FramesHelper) if defined?(Turbo::FramesHelper)
        view.class.include(SimpleUrlFor)
        view
      end
    end

    def render_with_action_view(template, locals = {})
      renderer = Herb::ActionViewRenderer.new
      renderer.method(:render)

      lookup_context = ::ActionView::LookupContext.new([])
      local_names = locals.reject { |k, _| k.to_s.start_with?("@") }.keys.map(&:to_sym)
      assigns = locals.select { |k, _| k.to_s.start_with?("@") }.transform_keys { |k| k.to_s.delete_prefix("@") }

      view = ::ActionView::Base.with_empty_template_cache.new(lookup_context, assigns, nil)
      view.class.include(Turbo::FramesHelper) if defined?(Turbo::FramesHelper)
      view.class.include(SimpleUrlFor)

      handler = ::ActionView::Template::Handlers::ERB.new
      action_view_template = ::ActionView::Template.new(template.strip, "(eval)", handler, locals: local_names, format: :html)
      local_values = locals.reject { |k, _| k.to_s.start_with?("@") }

      action_view_template.render(view, local_values)
    end
  end
end
