# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../snapshot_utils"
require_relative "../../../lib/herb/engine"
require_relative "font_awesome_rewriter"

module Engine
  module Rewriters
    class FontAwesomeRewriterTest < Minitest::Spec
      include SnapshotUtils

      private

      def compile(template)
        engine = Herb::Engine.new(template, escape: false, visitors: [fa_transformer])
        engine.src
      end

      def fa_transformer
        Herb::Rewriters::FontAwesomeRewriter.new
      end

      def assert_transform(from, to)
        result = compile(from)
        expected = "_buf = ::String.new; _buf << '#{to}'.freeze;\n_buf.to_s\n"
        assert_equal expected, result
      end

      test "has correct name and description" do
        assert_equal "font-awesome", Herb::Rewriters::FontAwesomeRewriter.transformer_name
        assert_includes Herb::Rewriters::FontAwesomeRewriter.description, "FontAwesome"
      end

      test "transforms fa() to <i>" do
        assert_transform(
          '<%= fa("home") %>',
          '<i class="fa fa-home"></i>'
        )
      end

      test "transforms fa() with symbol argument" do
        assert_transform(
          "<%= fa(:home) %>",
          '<i class="fa fa-home"></i>'
        )
      end

      test "transforms fa() with extra class" do
        assert_transform(
          '<%= fa("home", class: "text-red") %>',
          '<i class="fa fa-home text-red"></i>'
        )
      end

      test "transforms fa() with data attribute" do
        assert_transform(
          '<%= fa("home", data_controller: "icon") %>',
          '<i class="fa fa-home" data-controller="icon"></i>'
        )
      end

      test "transforms fa_icon() alias" do
        assert_transform(
          '<%= fa_icon("star") %>',
          '<i class="fa fa-star"></i>'
        )
      end

      test "skips fa() without arguments" do
        assert_compiled_snapshot("<%= fa %>", escape: false, visitors: [fa_transformer])
      end

      test "transforms fa() in HTML context" do
        assert_transform(
          '<nav><%= fa("menu") %> Menu</nav>',
          '<nav><i class="fa fa-menu"></i> Menu</nav>'
        )
      end

      test "transforms fa() with dynamic attribute value" do
        assert_compiled_snapshot('<%= fa("home", title: @tooltip) %>', escape: false, visitors: [fa_transformer])
      end

      test "does not affect unmatched helpers" do
        assert_compiled_snapshot('<%= fa("home") %><%= link_to "About", "/about" %>', escape: false, visitors: [fa_transformer])
      end
    end
  end
end
