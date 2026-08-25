# frozen_string_literal: true

require "json"

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/visitor"
require_relative "../../../lib/herb/engine/report/session"

module Engine
  module Slots
    class ManifestChannelTest < Minitest::Spec
      TEMPLATE = %(<li id="<%= @n %>"><%= @n %></li>) #: String

      def compile(deliver:, source: TEMPLATE, filename: "app/views/posts/_card.html.erb")
        visitor = Herb::Engine::Slots::Visitor.new(mode: :client, deliver: deliver)

        Herb::Engine.new(source, visitors: [visitor], filename: filename).src
      end

      def view(source)
        view = Object.new

        view.instance_variable_set(:@_herb_covered, {})
        view.define_singleton_method(:render) { |n|
          @n = n
          instance_eval(source, __FILE__, __LINE__)
        }

        view
      end

      def channel_after(renders, source)
        session = Herb::Engine::Report::Session.capture { renders.times { |n| view(source).render(n) } }

        session.channel(Herb::Engine::Slots::Manifest::Channel::NAME) { nil }
      end

      test "writes nothing at all unless a delivery asks for it" do
        compiled = compile(deliver: :none)

        refute_includes compiled, "data-herb-manifest"
        refute_includes compiled, "SlotManifest::Channel"
      end

      test "refuses a delivery it does not have" do
        error = assert_raises(ArgumentError) { Herb::Engine::Slots::Visitor.new(deliver: :everywhere) }

        assert_match(/deliver has to be one of/, error.message)
      end

      test "writes the manifest beside the region when asked to inline it" do
        rendered = view(compile(deliver: :inline)).render(1)

        assert_includes rendered, %(<template data-herb-manifest="app/views/posts/_card.html.erb:)
        assert_equal 1, rendered.scan("data-herb-manifest").size
      end

      test "inlines the manifest once for a partial rendered many times in one response" do
        source = compile(deliver: :inline)
        page = view(source)
        rendered = Array.new(3) { |n| page.render(n) }.join

        assert_equal 1, rendered.scan("data-herb-manifest").size
      end

      test "what it inlines is the manifest, as JSON" do
        rendered = view(compile(deliver: :inline)).render(1)
        json = rendered[%r{<template data-herb-manifest="[^"]+">(.*?)</template>}m, 1]

        assert_equal ["file", "identifier", "version", "slots", "names", "parts", "states"], JSON.parse(json).keys
      end

      test "records the manifest once for a partial rendered many times when it is hoisted" do
        channel = channel_after(3, compile(deliver: :hoist))

        assert_equal 1, channel.manifests.size
        assert_match(%r{\Aapp/views/posts/_card\.html\.erb:[0-9a-f]{8}\z}, channel.manifests.keys.fetch(0))
      end

      test "a hoisted page carries no manifest markup of its own" do
        rendered = view(compile(deliver: :hoist)).render(1)

        refute_includes rendered, "data-herb-manifest"
      end

      test "the channel anchors where a page ends, and says how many it carries" do
        channel = channel_after(1, compile(deliver: :hoist))

        assert_equal :body, channel.anchor
        assert_includes channel.to_html, %(<template data-herb-manifests data-count="1">)
      end

      test "what the channel renders is one JSON object keyed by template and version" do
        channel = channel_after(1, compile(deliver: :hoist))
        json = channel.to_html[%r{data-count="\d+">(\{.*\})</template>}m, 1]
        parsed = JSON.parse(json)

        assert_equal 1, parsed.size
        assert_equal "app/views/posts/_card.html.erb", parsed.values.fetch(0)["file"]
      end

      test "keeps the manifests of two templates apart" do
        first = compile(deliver: :hoist)
        second = compile(deliver: :hoist, filename: "app/views/posts/_row.html.erb")

        session = Herb::Engine::Report::Session.capture do
          view(first).render(1)
          view(second).render(2)
        end

        channel = session.channel(Herb::Engine::Slots::Manifest::Channel::NAME) { nil }

        assert_equal 2, channel.manifests.size
      end

      test "recording outside a session neither raises nor leaks into the next one" do
        source = compile(deliver: :hoist)

        view(source).render(1)

        session = Herb::Engine::Report::Session.capture { view(source).render(2) }

        assert_equal 1, session.channel(Herb::Engine::Slots::Manifest::Channel::NAME) { nil }.manifests.size
      end

      test "an empty channel renders nothing, so a page that says nothing carries nothing" do
        channel = Herb::Engine::Slots::Manifest::Channel.new

        assert_predicate channel, :empty?
        assert_equal "", channel.to_html
      end
    end
  end
end
