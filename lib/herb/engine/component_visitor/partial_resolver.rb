# frozen_string_literal: true

require_relative "resolver"

module Herb
  class Engine
    class ComponentVisitor < Herb::Visitor
      # Resolves a dot separated tag name to a partial path, so `<Users.ProfileCard />` becomes
      # `render "users/profile_card"`.
      #
      # The tag name has to parse first, which needs the `dot_notation_tags` parser option.
      class PartialResolver < Resolver
        TAG_NAME = /\A[A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)+\z/

        #: (String) -> bool
        def handles?(tag_name)
          tag_name.match?(TAG_NAME)
        end

        #: (String, Hash[String, String], block: bool) -> String
        def render_code(tag_name, attributes, block: false)
          path = partial_path(tag_name)

          if block
            return %(render layout: "#{path}") if attributes.empty?

            %(render layout: "#{path}", locals: { #{keyword_arguments(attributes)} })
          else
            return %(render "#{path}") if attributes.empty?

            %(render "#{path}", #{keyword_arguments(attributes)})
          end
        end

        private

        # `Users.ProfileCard` -> `users/profile_card`
        #: (String) -> String
        def partial_path(tag_name)
          tag_name.split(".").map { |segment| underscore(segment) }.join("/")
        end

        #: (String) -> String
        def underscore(segment)
          segment
            .gsub(/([A-Z])(?=[A-Z][a-z])/, '\1_')
            .gsub(/([a-z\d])([A-Z])/, '\1_\2')
            .downcase
        end
      end
    end
  end
end
