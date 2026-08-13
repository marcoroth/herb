# frozen_string_literal: true

module Herb
  module Analysis
    class RenderGraph
      TemplateRoots = Data.define(:tags, :conditional_tags, :renders, :resolved)

      class TemplateRoots
        #: (Hash[String, untyped]) -> TemplateRoots
        def self.from(data)
          new(
            tags: data["tags"] || [],
            conditional_tags: data["conditionalTags"] || [],
            renders: data["renders"] || [],
            resolved: data.fetch("resolved", true)
          )
        end

        #: () -> Hash[String, untyped]
        def to_h
          {
            "tags" => tags,
            "conditionalTags" => conditional_tags,
            "renders" => renders,
            "resolved" => resolved
          }
        end
      end
    end
  end
end
