# frozen_string_literal: true

require "bigdecimal"
require "action_view"

turbo_rails_path = Gem.loaded_specs["turbo-rails"]&.full_gem_path

if turbo_rails_path
  module Turbo; end unless defined?(Turbo)
  require "#{turbo_rails_path}/app/helpers/turbo/frames_helper"
end

module Herb
  class ActionViewRenderer
    def self.render(source, locals = {})
      new.render(source, locals)
    end

    def render(source, locals = {})
      view = build_view(locals)
      template = build_template(source, locals)
      local_values = locals.reject { |key, _| key.to_s.start_with?("@") }

      template.render(view, local_values)
    end

    private

    def build_view(locals)
      assigns = locals
                .select { |key, _| key.to_s.start_with?("@") }
                .transform_keys { |key| key.to_s.delete_prefix("@") }

      lookup_context = ActionView::LookupContext.new([])
      view = ActionView::Base.with_empty_template_cache.new(lookup_context, assigns, nil)
      view.class.include(Turbo::FramesHelper) if defined?(Turbo::FramesHelper)
      view
    end

    def build_template(source, locals)
      local_names = locals.reject { |key, _| key.to_s.start_with?("@") }.keys.map(&:to_sym)
      handler = ActionView::Template::Handlers::ERB.new

      ActionView::Template.new(
        source,
        "(eval)",
        handler,
        locals: local_names,
        format: :html
      )
    end
  end
end
