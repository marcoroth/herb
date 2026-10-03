# frozen_string_literal: true

require_relative "../../test_helper"
require "herb/engine/slots/schema_compiler"

module Engine
  module Slots
    class SchemaCompilerTest < Minitest::Spec
      FILENAME = "app/views/posts/index.html.erb"

      def compile(source, mode: :client, visitors: -> { [] })
        Herb::Engine::Slots::SchemaCompiler.call(source, filename: FILENAME, mode: mode, visitors: visitors)
      end

      test "the version matches what a marking page compile produces" do
        source = "<p><%= name %></p><% if open %><b>hi</b><% end %>"

        page_visitor = Herb::Engine::Slots::Visitor.new(mode: :client, mark: true, deliver: :none, fatal: false)
        Herb::Engine.new(source, visitors: [page_visitor], filename: FILENAME)

        assert_equal page_visitor.version, compile(source).version
      end

      test "carries the manifest and the slot entries" do
        result = compile("<p data-herb-name=\"title\"><%= title %></p>")

        assert_equal({ "title" => 0 }, result.manifest["names"])
        assert_equal([0], result.slot_entries.map { |entry| entry[:index] })
      end

      test "parks statics for the branches a client would build" do
        result = compile("<% if open %><b>yes</b><% else %><i>no</i><% end %>")

        refute_nil result.statics
        assert(result.statics.keys.any? { |key| key.start_with?("0:") })
      end

      test "the static markup holds every slot as an empty marker pair and no region wrapper" do
        result = compile("<p>Hello, <%= name %></p>")

        assert_equal "<p>Hello, <!--herb-slot:0--><!--/herb-slot:0--></p>", result.static_markup
      end

      test "a server mode template still has static markup" do
        result = compile("<p><%= name %></p>", mode: :server)

        assert_equal :server, result.mode
        assert_equal "<p data-herb-slot=\"0:child\"></p>", result.static_markup
      end

      test "a nil mode compiles for diagnostics and answers nothing slot shaped" do
        validators = -> { [Herb::Engine::Validators::NestingValidator.new(fatal: false)] }
        result = compile("<p><div>block in p</div></p>", mode: nil, visitors: validators)

        assert_nil result.version
        assert_nil result.manifest
        assert_nil result.static_markup
        refute_empty result.diagnostics
      end

      test "collects diagnostics from the whole stack, the slot visitor included" do
        source = "<%# herb:state (count: 0) %>\n<% count = 5 %>\n<p><%= count %></p>\n"
        result = compile(source)

        assert(result.diagnostics.any? { |diagnostic| diagnostic.code == "herb-state-assignment" })
      end

      test "a helper element prints into the static markup the way the page renders it" do
        result = compile("<div><%= image_tag \"https://example.com/a.png\" %></div>")

        assert_equal "<div><img src=\"https://example.com/a.png\"></div>", result.static_markup
      end

      test "a helper element with a dynamic attribute keeps its slot anchor in the static markup" do
        result = compile("<div><%= image_tag avatar_url %></div>")

        assert_equal "<div><img src=\"\" data-herb-slot=\"0:attribute:src\"></div>", result.static_markup
        assert_equal([[0, :attribute, "src"]], result.slot_entries.map { |entry| [entry[:index], entry[:type], entry[:attribute]] })
      end

      test "a degraded template answers nil static markup" do
        source = "<%# herb:state (count: 0) %>\n<% count = 5 %>\n<p><%= count %></p>\n"
        result = compile(source)

        assert_nil result.static_markup
      end
    end
  end
end
