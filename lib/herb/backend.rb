# frozen_string_literal: true

module Herb
  # What the native extension defines, declared in Ruby so that it can be read without reading C.
  #
  # Loading the extension reopens this module and defines each method for real, so nothing here
  # runs in a working install. What is left when the extension does not load is a set of methods
  # that say so, instead of the `NoMethodError` a missing definition would raise:
  #
  #     Herb::Backend.parse(source)
  #     #=> NotImplementedError: Herb::Backend.parse is defined by the native extension, which did not load
  #
  # The public API is `Herb.parse` and its neighbours, which are Ruby and live in `lib/herb.rb`.
  # This is only the seam they call through.
  #
  module Backend
    module Unavailable
      #: (String, **untyped) -> Herb::ParseResult
      def parse(_source, **)
        unavailable(__method__)
      end

      #: (String, **untyped) -> Herb::LexResult
      def lex(_source, **)
        unavailable(__method__)
      end

      #: (String, **untyped) -> String
      def extract_ruby(_source, **)
        unavailable(__method__)
      end

      #: (String) -> String
      def extract_html(_source)
        unavailable(__method__)
      end

      #: (String, String, **untyped) -> Herb::Diff::Result
      def diff(_old_source, _new_source, **)
        unavailable(__method__)
      end

      #: (**untyped) -> untyped
      def arena_stats(**)
        unavailable(__method__)
      end

      #: (String) -> untyped
      def leak_check(_source)
        unavailable(__method__)
      end

      #: () -> String
      def version
        unavailable(__method__)
      end

      private

      #: (Symbol?) -> bot
      def unavailable(name)
        raise NotImplementedError, "Herb::Backend.#{name} is defined by the native extension, which did not load"
      end
    end

    extend Unavailable
  end
end
