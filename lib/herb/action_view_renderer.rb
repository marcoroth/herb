# frozen_string_literal: true

require "bigdecimal"
require "action_view"

module Herb
  class ActionViewRenderer
    def self.render(source)
      new.render(source)
    end

    def render(source)
      lookup_context = ActionView::LookupContext.new([])
      view = ActionView::Base.with_empty_template_cache.new(lookup_context, {}, nil)
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
