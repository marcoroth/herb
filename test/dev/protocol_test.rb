# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/dev/protocol"
require "herb/engine/slots/visitor"

module Dev
  class ProtocolTest < Minitest::Spec
    def slot_entries(source)
      visitor = Herb::Engine::Slots::Visitor.new(mark: false, deliver: :none, fatal: false)

      Herb::Engine.new(source, visitors: [visitor], filename: "app/views/posts/index.html.erb")

      visitor.slot_entries
    end

    def remap_between(old_source, new_source)
      Herb::Dev::Protocol.remap(
        slot_entries(old_source),
        slot_entries(new_source),
        Herb.diff(old_source, new_source, track_whitespace_changes: true).operations
      )
    end

    test "an untouched slot keeps its index" do
      remap = remap_between("<p><%= name %></p>", "<p class=\"card\"><%= name %></p>")

      assert_equal({ "slots" => { "0" => 0 } }, remap)
    end

    test "wrapping an output drops its mapping, since depth shifts are not modeled" do
      remap = remap_between("Hello, <%= name %>", "<p>Hello, <%= name %></p>")

      refute_nil remap
      assert_nil remap["slots"]["0"]
    end

    test "a conditional added above shifts the slot down" do
      remap = remap_between(
        "<p><%= name %></p>",
        "<% if admin %><b>hi</b><% end %><p><%= name %></p>"
      )

      refute_nil remap
      assert_equal 1, remap["slots"]["0"]
    end

    test "removing one of two slots maps one to the survivor and the other to nil" do
      remap = remap_between("<p><%= name %></p><p><%= email %></p>", "<p><%= name %></p>")

      refute_nil remap
      assert_equal([0, nil], remap["slots"].values_at("0", "1").sort_by { |target| target ? 0 : 1 })
    end

    test "named slots pin the mapping when paths are ambiguous" do
      old_source = "<div data-herb-name=\"greeting\"><%= greeting %></div>"
      new_source = "<section><p>static</p></section><div data-herb-name=\"greeting\"><%= greeting %></div>"

      remap = remap_between(old_source, new_source)

      refute_nil remap

      old_named = slot_entries(old_source).find { |entry| entry[:name] == "greeting" }
      new_named = slot_entries(new_source).find { |entry| entry[:name] == "greeting" }

      assert_equal new_named[:index], remap["slots"][old_named[:index].to_s]
    end

    test "a moved node bails to nil" do
      remap = remap_between(
        "<p><%= name %></p><span>x</span><p><%= email %></p>",
        "<p><%= email %></p><span>x</span><p><%= name %></p>"
      )

      operations = Herb.diff(
        "<p><%= name %></p><span>x</span><p><%= email %></p>",
        "<p><%= email %></p><span>x</span><p><%= name %></p>"
      ).operations

      if operations.any? { |operation| operation.type == :node_moved }
        assert_nil remap
      else
        skip "diff did not report a move for this shape"
      end
    end

    test "too many operations bail to nil" do
      operations = Array.new(33) { Struct.new(:type, :path).new(:text_changed, [0]) }

      assert_nil Herb::Dev::Protocol.remap([], [], operations)
    end

    test "schema always carries diagnostics" do
      message = Herb::Dev::Protocol.schema(file: "a.html.erb", mode: :client, from: nil, to: "abcd1234")

      assert_equal [], message[:diagnostics]
      assert_equal({ from: nil, to: "abcd1234" }, message[:version])
      assert_equal "client", message[:mode]
    end

    test "invalidate stringifies its scope" do
      message = Herb::Dev::Protocol.invalidate(file: "a.html.erb", version: nil, node_path: [0, 1], scope: :fetch)

      assert_equal "fetch", message[:scope]
      assert_nil message[:version]
    end

    test "error keeps the wire shape the browser already reads" do
      source = "<div>\n  <form>\n</div>\n"
      errors = Herb.parse(source, strict: true, analyze: true).errors
      message = Herb::Dev::Protocol.error(file: "a.html.erb", source: source, errors: errors)

      entry = message[:errors].first

      assert entry[:name]
      assert entry[:message]
      assert_equal 2, entry.fetch(:line)
      assert message[:source]
    end
  end
end
