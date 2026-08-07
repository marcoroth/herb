# frozen_string_literal: true

require_relative "resolver"

module Herb
  class Engine
    class ComponentVisitor < Herb::Visitor
      # Resolves a tag name that is a Ruby constant, so `<Card />` becomes `render Card.new` and
      # `<Users::Card />` becomes `render Users::Card.new`.
      class ComponentResolver < Resolver
        TAG_NAME = /\A[A-Z][A-Za-z0-9_]*(?:::[A-Z][A-Za-z0-9_]*)*\z/

        #: (String) -> bool
        def handles?(tag_name)
          tag_name.match?(TAG_NAME)
        end

        #: (String, Hash[String, String], block: bool) -> String
        def render_code(tag_name, attributes, block: false) # rubocop:disable Lint/UnusedMethodArgument
          return "render #{tag_name}.new" if attributes.empty?

          "render #{tag_name}.new(#{keyword_arguments(attributes)})"
        end
      end
    end
  end
end
