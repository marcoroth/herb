# frozen_string_literal: true

module Herb
  class Engine
    class ComponentVisitor < Herb::Visitor
      # Decides what a tag renders to. A resolver claims a tag name through `handles?` and turns
      # it into the Ruby source for a `render` call through `render_code`.
      #
      # Resolution is static: a resolver only ever sees the tag name and its attributes, never the
      # application it compiles against.
      class Resolver
        #: (String) -> bool
        def handles?(tag_name)
          raise NotImplementedError, "#{self.class} must implement #handles?"
        end

        #: (String, Hash[String, String], block: bool) -> String
        def render_code(tag_name, attributes, block:)
          raise NotImplementedError, "#{self.class} must implement #render_code"
        end

        private

        #: (Hash[String, String]) -> String
        def keyword_arguments(attributes)
          attributes.map { |name, value| "#{name}: #{value}" }.join(", ")
        end
      end
    end
  end
end
