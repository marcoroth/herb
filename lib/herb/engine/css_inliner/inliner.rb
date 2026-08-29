# frozen_string_literal: true

module Herb
  class Engine
    module CSSInliner
      # Writes the CSS a template rendered into `style` attributes on the markup it applies to.
      #
      #     Herb::Engine::CSSInliner.inliner = Herb::Engine::CSSInliner::Inliner.new
      #
      # A template compiled with `CSSInliner::Visitor` hands everything it rendered to
      # `CSSInliner.inline`, and this is what answers. Where the CSS came from is not something this
      # has to know: a `<style>` block the template wrote, a block `ScopedStyle::Visitor` narrowed,
      # and a stylesheet read at compile time all arrive the same way, and all of it is matched
      # against the markup in the same buffer.
      #
      # Without an inliner installed, or if one fails, the markup is answered as it was rendered. The
      # `<style>` blocks are still in it, so the CSS applies as it was written and the template is
      # correct either way. Installing this is what turns a block into attributes, not what makes it
      # work.
      #
      # The markup is wrapped in a `<template>` before it is parsed. A template renders a fragment,
      # and a fragment is parsed in whatever context it is given: parsed as a body, a file whose
      # roots are `<tr>` or `<td>` is not mangled but dropped, and `<tr><td>x</td></tr>` comes back
      # as `x`. `<template>` is the one context that holds every element a file can start with.
      #
      # `keep` says whether the blocks the CSS came from are written out again, which they have to be
      # when the CSS holds anything a `style` attribute cannot say. An inliner drops those rules
      # instead of keeping them, so CSS holding `:hover` or `@media` is kept and says the rest twice.
      # Which it is, is decided when the template is compiled.
      #
      # Anything answering `inline_fragment` with the markup and a stylesheet can stand in for
      # `CSSInline::CSSInliner`, which is the only thing this needs it to be.
      #
      class Inliner
        OPEN = "<template>" #: String
        CLOSE = "</template>" #: String

        #: (?keeping: untyped, ?dropping: untyped) -> void
        def initialize(keeping: nil, dropping: nil)
          @keeping = keeping || build(true)
          @dropping = dropping || build(false)
        end

        #: (String, ?String, ?keep: bool) -> String
        def call(html, css = "", keep: false)
          inliner = keep ? @keeping : @dropping
          inlined = inliner.inline_fragment("#{OPEN}#{html}#{CLOSE}", css)

          inlined.delete_prefix(OPEN).delete_suffix(CLOSE)
        rescue StandardError
          html
        end

        #: () -> String
        def inspect
          "#<#{self.class.name}>"
        end

        private

        #: (bool) -> untyped
        def build(keep)
          require "css_inline"

          ::CSSInline::CSSInliner.new(keep_style_tags: keep, inline_style_tags: true) # steep:ignore
        end
      end

      @inliner = nil #: untyped

      class << self
        attr_writer :inliner #: untyped

        #: () -> untyped
        def inliner
          return @inliner unless @inliner.nil?

          @inliner = build
        end

        #: (String, ?String, ?keep: bool) -> String
        def inline(html, css = "", keep: false)
          built = inliner

          return html unless built

          built.call(html, css, keep: keep)
        end

        private

        #: () -> untyped
        def build
          Inliner.new
        rescue LoadError
          false
        end
      end
    end
  end
end
