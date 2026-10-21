# frozen_string_literal: true

require_relative "action_view_test_helper"
require_relative "../../../lib/herb/engine/slots/visitor"
require "reactionview/template/handlers/herb/herb"

module Engine
  module ActionView
    class DynamicContentTagTest < Minitest::Spec
      include ActionViewTestHelper

      test "dynamic tag names retain their content argument once" do
        assert_optimized_output_match('<%= content_tag(name, "x", class: "a") %>', { name: :section })
      end

      test "dynamic tag names retain their block" do
        assert_runtime_output_match('<%= content_tag(name, class: "a") do %>x<% end %>', { name: :section })
      end

      test "local tag names and content remain runtime expressions" do
        template = '<% name = :section; content = "x" %><%= content_tag(name, content, class: "a") %>'
        assert_optimized_output_match(template)
      end

      test "conditional tag names retain their block and nested helpers" do
        template = '<%= content_tag(flag ? :a : :div, class: "a") do %><%= tag.span "x" %><% end %>'
        assert_runtime_output_match(template, { flag: true })
        assert_runtime_output_match(template, { flag: false })
      end

      test "dynamic tag names retain an inline block" do
        assert_optimized_output_match('<%= content_tag(name, class: "a") { "x" } %>', { name: :section })
      end

      test "dynamic tag names compile with the parser option alone" do
        template = '<%= content_tag(name, class: "a") do %>x<% end %>'
        rendered = render_runtime_template(template, { name: :section }, parser_options: { action_view_helpers: true })
        assert_equal '<section class="a">x</section>', rendered
      end

      test "slots retain runtime calls for dynamic tag names" do
        template = '<%= content_tag(name, "x", class: "a") %>'
        rendered = render_runtime_template(template, { name: :section }, visitors: [Herb::Engine::Slots::Visitor.new(mode: :server)])
        element = Nokogiri::HTML.fragment(rendered).at_css("section.a")
        assert_equal "x", element.text
        assert_equal 1, Nokogiri::HTML.fragment(rendered).css("section").size
        assert_empty Nokogiri::HTML.fragment(rendered).xpath("./text()").map(&:text).join
      end

      test "slots retain runtime blocks for dynamic tag names" do
        template = '<%= content_tag(name, class: "a") do %>x<% end %>'
        rendered = render_runtime_template(template, { name: :section }, visitors: [Herb::Engine::Slots::Visitor.new(mode: :server)])
        assert_equal "x", Nokogiri::HTML.fragment(rendered).at_css("section.a").text
      end

      private

      def assert_runtime_output_match(template, locals)
        rendered = render_runtime_template(template, locals, visitors: [Herb::Engine::OptimizeVisitor.new])
        assert_equal render_with_action_view(template, locals), rendered
      end

      def render_runtime_template(template, locals, **)
        engine = ReActionView::Template::Handlers::Herb::Herb.new(template, **, validate_ruby: true)
        action_view_eval("@output_buffer = ::ActionView::OutputBuffer.new; #{engine.src}", locals).to_s
      end
    end
  end
end
