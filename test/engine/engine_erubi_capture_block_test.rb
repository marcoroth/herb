# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

require "erubi"
require "erubi/capture_block"

module Engine
  class EngineErubiCaptureBlockTest < Minitest::Spec
    BUFVAR = "@bufvar"
    BUFVAL = "::Erubi::CaptureBlockEngine::Buffer.new"

    def render_with_herb(template, options = {})
      evaluate(Herb::Engine.new(template, options.merge(bufvar: BUFVAR, bufval: BUFVAL)).src)
    end

    def render_with_capture_block_erubi(template, options = {})
      evaluate(Erubi::CaptureBlockEngine.new(template, options.merge(bufvar: BUFVAR)).src)
    end

    def evaluate(source)
      context = Object.new

      def context.upcase_form(&)
        "<form>#{@bufvar.capture(&).upcase}</form>"
      end

      def context.wrap(&)
        "[#{@bufvar.capture(&)}]"
      end

      context.instance_eval(source)
    end

    def assert_matches_capture_block_erubi(template, options = {})
      herb = render_with_herb(template, options)

      assert_equal render_with_capture_block_erubi(template, options), herb

      herb
    end

    test "captures a block the way Erubi's capture block engine does" do
      template = "<%= upcase_form do %><%= \"foo\" %><% end %>"

      assert_equal "<form>FOO</form>", assert_matches_capture_block_erubi(template)
    end

    test "captures a block with text around it" do
      assert_equal "a[b]c", assert_matches_capture_block_erubi("a<%= wrap do %>b<% end %>c")
    end

    test "captures nested blocks" do
      template = "<%= wrap do %><%= wrap do %>x<% end %><% end %>"

      assert_equal "[[x]]", assert_matches_capture_block_erubi(template)
    end

    test "captures an escaping tag inside the block" do
      template = "<%= wrap do %><%= \"<b>\" %><% end %>"

      assert_matches_capture_block_erubi(template, { escape: true })
    end

    test "captures a raw tag inside the block" do
      template = "<%= wrap do %><%== \"<b>\" %><% end %>"

      assert_matches_capture_block_erubi(template, { escape: true })
    end

    test "generates the same append structure, with <<= standing in for <<" do
      template = "<%= wrap do %>x<% end %>"

      herb = Herb::Engine.new(template, bufvar: BUFVAR, bufval: BUFVAL).src
      erubi = Erubi::CaptureBlockEngine.new(template, bufvar: BUFVAR).src

      assert_includes herb, "@bufvar << (wrap do;"
      assert_includes erubi, "@bufvar <<=  wrap do ;"
    end

    test "needs a capture-aware buffer, which the default bufval is not" do
      template = "<%= wrap do %>x<% end %>"

      assert_raises(NoMethodError) { evaluate(Herb::Engine.new(template, bufvar: BUFVAR).src) }
    end
  end
end
