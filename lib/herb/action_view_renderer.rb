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
    def self.render(source)
      new.render(source)
    end

    def render(source)
      lookup_context = ActionView::LookupContext.new([])
      view = ActionView::Base.with_empty_template_cache.new(lookup_context, {}, nil)
      view.class.include(Turbo::FramesHelper) if defined?(Turbo::FramesHelper)
      handler = ActionView::Template::Handlers::ERB.new

      template = ActionView::Template.new(
        source,
        "(eval)",
        handler,
        locals: [],
        format: :html
      )

      template.render(view, {})
    end
  end
end
