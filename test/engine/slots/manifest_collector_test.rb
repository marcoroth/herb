# frozen_string_literal: true

require "json"
require "tmpdir"
require "fileutils"

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/slots/manifest/collector"
require_relative "../../../lib/herb/engine/report/session"

module Engine
  module Slots
    class ManifestCollectorTest < Minitest::Spec
      include SnapshotUtils

      def setup
        @root = Dir.mktmpdir("herb_manifest_collector")
        @views = File.join(@root, "app", "views", "posts")

        FileUtils.mkdir_p(@views)
      end

      def teardown
        FileUtils.rm_rf(@root)
      end

      def write(name, source)
        path = File.join(@views, name)

        File.write(path, source)

        path
      end

      def collector
        Herb::Engine::Slots::Manifest::Collector.new(project_path: @root)
      end

      test "gathers what a template says about itself without rendering it" do
        write("index.html.erb", %(<ul data-herb-name="rows"><li><%= @a %></li></ul>))

        subject = collector
        subject.add_all(File.join(@root, "app", "views"))

        assert_equal 1, subject.manifests.size
        assert_equal({ "rows" => 0 }, subject.manifests.values.fetch(0)["names"])
      end

      test "leaves out a template with nothing of its own to say" do
        write("plain.html.erb", "<p><%= @a %></p>")

        subject = collector

        assert_nil subject.add(File.join(@views, "plain.html.erb"))
        assert_predicate subject, :empty?
      end

      test "keys a manifest the way a page names the template" do
        path = write("index.html.erb", %(<p data-herb-name="body"><%= @a %></p>))
        key = collector.add(path)

        assert_equal "app/views/posts/index.html.erb", key.split(":").first
        assert_match(/\A[0-9a-f]{8}\z/, key.split(":").last)
      end

      test "says which files it could not compile, and carries on" do
        write("broken.html.erb", "<% if %>")
        write("index.html.erb", %(<p data-herb-name="body"><%= @a %></p>))

        subject = collector
        subject.add_all(File.join(@root, "app", "views"))

        assert_equal 1, subject.failures.size
        assert_equal 1, subject.manifests.size
      end

      test "what it extracts is what a response would have carried" do
        source = %(<%# herb:state (open: false) %><ul data-herb-name="rows"><li class="row-<%= @k %>-x"><% if open %>o<% end %></li></ul>)
        path = write("index.html.erb", source)

        extracted = JSON.parse(collector.tap { |subject| subject.add(path) }.to_json)

        visitor = Herb::Engine::Slots::Visitor.new(mode: :client, deliver: :hoist)
        src = Herb::Engine.new(source, visitors: [visitor], filename: "app/views/posts/index.html.erb", project_path: @root).src

        view = Object.new
        view.instance_variable_set(:@_herb_covered, {})
        view.define_singleton_method(:render) { instance_eval(src, __FILE__, __LINE__) }

        session = Herb::Engine::Report::Session.capture { view.render }
        channel = session.channel(Herb::Engine::Slots::Manifest::Channel::NAME) { nil }
        delivered = JSON.parse(channel.to_html[%r{data-count="\d+">(\{.*\})</template>}m, 1])

        assert_equal delivered, extracted
      end

      test "a project that extracts its manifests sends none with the page" do
        assert_compiled_snapshot(
          %(<p data-herb-name="body"><%= @a %></p>),
          { visitors: [Herb::Engine::Slots::Visitor.new(mode: :client, deliver: :none)], filename: "app/views/posts/index.html.erb" }
        )
      end
    end
  end
end
