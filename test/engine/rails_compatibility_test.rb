# frozen_string_literal: true

require "action_view"

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class RailsCompatibilityTest < Minitest::Spec
    class RailsHerb < ::Herb::Engine
      BLOCK_EXPR = /((\s|\))do|\{)(\s*\|[^|]*\|)?\s*\Z/

      def initialize(input, properties = {})
        @newline_pending = 0

        properties = properties.dup
        properties[:bufvar] ||= "@output_buffer"
        properties[:preamble] ||= ""
        properties[:postamble] ||= properties[:bufvar].to_s
        properties[:freeze_template_literals] = !ActionView::Template.frozen_string_literal
        properties[:escapefunc] = ""

        super
      end

      private

      def add_text(text)
        return if text.empty?

        if text == "\n"
          @newline_pending += 1
        else
          with_buffer do
            @src << ".safe_append='"
            @src << ("\n" * @newline_pending) if @newline_pending.positive?
            @src << text.gsub(/['\\]/, '\\\\\&') << @text_end
          end
          @newline_pending = 0
        end
      end

      def add_expression(indicator, code)
        flush_newline_if_pending(@src)

        with_buffer do
          @src << if ((indicator == "==") && !@escape) || ((indicator == "=") && @escape)
                    ".append="
                  else
                    ".safe_expr_append="
                  end

          if BLOCK_EXPR.match?(code)
            @src << " " << code
          else
            @src << "(" << code << ")"
          end
        end
      end

      def add_code(code)
        flush_newline_if_pending(@src)
        super
      end

      def add_postamble(_)
        flush_newline_if_pending(@src)
        super
      end

      def flush_newline_if_pending(src)
        return unless @newline_pending.positive?

        with_buffer { src << ".safe_append='#{"\\n" * @newline_pending}" << @text_end }
        @newline_pending = 0
      end
    end

    test "rails erb handler basic content with escaping" do
      template = "<h1><%= @title %></h1>"

      engine = RailsHerb.new(template, escape: true)

      @output_buffer = ActionView::OutputBuffer.new
      @title = "Hello <script>alert('XSS')</script>"

      result = eval(engine.src)

      expected = "<h1>Hello &lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;</h1>"
      assert_equal expected, result.to_s
    end

    test "rails erb handler mixed escaped and raw" do
      template = "<div><%= @safe %> <%== @raw %></div>"

      engine = RailsHerb.new(template, escape: true)

      @output_buffer = ActionView::OutputBuffer.new
      @safe = "<b>Bold</b>"
      @raw = "<i>Italic</i>"

      result = eval(engine.src)

      expected = "<div>&lt;b&gt;Bold&lt;/b&gt; <i>Italic</i></div>"
      assert_equal expected, result.to_s
    end

    test "rails erb handler block expressions" do
      template = "<% @items.each do |item| %><li><%= item %></li><% end %>"

      engine = RailsHerb.new(template, escape: true)

      @output_buffer = ActionView::OutputBuffer.new
      @items = ["Apple", "Banana", "Cherry"]

      result = eval(engine.src)

      expected = "<li>Apple</li><li>Banana</li><li>Cherry</li>"
      assert_equal expected, result.to_s
    end

    test "rails erb handler multiline with proper newline handling" do
      template = <<~ERB
        <div class="container">
          <h1><%= @title %></h1>
          <p><%= @description %></p>
        </div>
      ERB

      engine = RailsHerb.new(template, escape: true)

      @output_buffer = ActionView::OutputBuffer.new
      @title = "Welcome"
      @description = "This is a test"

      result = eval(engine.src)

      expected = <<~HTML
        <div class="container">
          <h1>Welcome</h1>
          <p>This is a test</p>
        </div>
      HTML

      assert_equal expected, result.to_s
    end

    test "rails erb handler generates correct ruby code structure" do
      template = "<h1><%= @title %></h1>"

      engine = RailsHerb.new(template, escape: true)

      assert_equal "\n @output_buffer.safe_append='<h1>'.freeze; @output_buffer.append=(@title); @output_buffer.safe_append='</h1>'.freeze;\n@output_buffer", engine.src
    end

    test "drop-in replacement compatibility" do
      template = "<p><%= @content %></p>"

      assert_equal ::Herb::Engine, RailsHerb.superclass

      engine = RailsHerb.new(template, escape: true)

      @output_buffer = ActionView::OutputBuffer.new
      @content = "<script>alert('xss')</script>"

      result = eval(engine.src)

      expected = "<p>&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;</p>"
      assert_equal expected, result.to_s
    end
  end
end
