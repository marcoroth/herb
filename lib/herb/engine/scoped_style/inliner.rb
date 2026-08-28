# frozen_string_literal: true

module Herb
  class Engine
    module ScopedStyle
      # Writes the CSS a template scoped into `style` attributes on the markup it applies to.
      #
      #     Herb::Engine::ScopedStyle.inliner = Herb::Engine::ScopedStyle::Inliner.new
      #
      # A template compiled with `deliver: :style_attributes` hands everything it rendered to
      # `ScopedStyle.inline`, and this is what answers. Nothing else has to be installed, and nothing
      # about the page the template landed in has to be known, because a file's scoped CSS and the
      # markup it applies to are the same file and arrive in the same buffer.
      #
      # Without an inliner installed, or if one fails, the markup is answered as it was rendered. The
      # `<style>` block is still in it, so the CSS applies as it was written and the template is
      # correct either way. Installing this is what turns the block into attributes, not what makes
      # it work.
      #
      # The markup is wrapped in a `<template>` before it is parsed. A template renders a fragment,
      # and a fragment is parsed in whatever context it is given: parsed as a body, a file whose
      # roots are `<tr>` or `<td>` is not mangled but dropped, and `<tr><td>x</td></tr>` comes back
      # as `x`. `<template>` is the one context that holds every element a file can start with.
      #
      # `keep` says whether the block the CSS came from is written out again, which it has to be when
      # the CSS holds anything a `style` attribute cannot say. An inliner drops those rules rather
      # than keeping them, so a block holding `:hover` or `@media` is kept and says the rest twice.
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

        #: (String, ?keep: bool) -> String
        def call(html, keep: false)
          inliner = keep ? @keeping : @dropping
          inlined = inliner.inline_fragment("#{OPEN}#{html}#{CLOSE}", "")

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

          ::CSSInline::CSSInliner.new(keep_style_tags: keep, inline_style_tags: true)
        end
      end

      @inliner = nil #: untyped

      class << self
        attr_accessor :inliner #: untyped

        #: (String, ?keep: bool) -> String
        def inline(html, keep: false)
          return html unless @inliner

          @inliner.call(html, keep: keep)
        end
      end
    end
  end
end
