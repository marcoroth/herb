# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

require "erubi"

module Engine
  class EngineErubiDivergenceTest < Minitest::Spec
    def compile_both(template, options = {})
      [Herb::Engine.new(template, options).src, Erubi::Engine.new(template, options).src]
    end

    def assert_diverges_from_erubi(template, options = {})
      herb, erubi = compile_both(template, options)

      refute_equal erubi, herb, "expected Herb::Engine and Erubi::Engine to differ for #{template.inspect}"

      [herb, erubi]
    end

    def without_expression_padding(source)
      source.gsub("( ", "(").gsub(" )", ")")
    end

    def with_herb_escape_module(source)
      source
        .gsub("__erubi = ::Erubi;", "__herb = ::Herb::Engine;")
        .gsub("__erubi.h", "__herb.h")
        .gsub("::Erubi.h", "::Herb::Engine.h")
    end

    def reported_line(engine, template)
      engine.new(template, filename: "template.erb").src.then do |source|
        eval(source, TOPLEVEL_BINDING.dup, "template.erb")
        nil
      end
    rescue RuntimeError => e
      e.backtrace.find { |line| line.include?("template.erb") }[/:(\d+)/, 1].to_i
    end

    def assert_reports_the_same_line_as_erubi(template)
      expected = template.lines.index { |line| line.include?("<% raise %>") } + 1

      assert_equal expected, reported_line(Herb::Engine, template)
      assert_equal expected, reported_line(Erubi::Engine, template)
    end

    def assert_renders_the_same_as_erubi(template, options = {}, **locals)
      herb = evaluate(Herb::Engine.new(template, options).src, locals)

      assert_equal evaluate(Erubi::Engine.new(template, options).src, locals), herb

      herb
    end

    def evaluate(source, locals)
      context = Object.new

      locals.each do |name, value|
        context.define_singleton_method(name) { value }
      end

      context.instance_eval(source)
    end

    test "adds no padding inside expression code" do
      [
        ["<div><%= title %></div>", {}],
        ["<%= content %>", { escape: false }],
        ["<%== content %>", { escape: false, escapefunc: "CGI.escapeHTML" }],
        ["<%= a %>\n<%= b %>\n", { chain_appends: true }],
        ["<%= a %>\n<%= b %>\n", { chain_appends: false }],
        ['<?xml-stylesheet type="text/xsl" href="<%= path %>"?>', {}]
      ].each do |template, options|
        herb, erubi = assert_diverges_from_erubi(template, options)

        assert_equal herb, without_expression_padding(erubi),
                     "expected padding to be the only difference for #{template.inspect} with #{options.inspect}"
      end
    end

    test "escapes through its own module instead of Erubi's" do
      herb, erubi = assert_diverges_from_erubi("<%= content %>", { escape: true })

      assert_includes herb, "__herb = ::Herb::Engine;"
      assert_includes herb, "__herb.h((content))"

      assert_includes erubi, "__erubi = ::Erubi;"
      assert_includes erubi, "__erubi.h(( content ))"

      assert_renders_the_same_as_erubi("<%= content %>", { escape: true }, content: "<b>")
    end

    test "names its own module in the default escape function" do
      herb, erubi = assert_diverges_from_erubi("<%== content %>", { escape: false })

      assert_includes herb, "::Herb::Engine.h((content))"
      assert_includes erubi, "::Erubi.h(( content ))"

      assert_renders_the_same_as_erubi("<%== content %>", { escape: false }, content: "<b>")
    end

    test "leaves out the escape module when no tag in the template escapes" do
      herb, erubi = assert_diverges_from_erubi("<%== content %>", { escape: true })

      refute_includes herb, "__herb"
      assert_includes erubi, "__erubi = ::Erubi;"

      assert_renders_the_same_as_erubi("<%== content %>", { escape: true }, content: "<b>")
    end

    test "escapes an attribute value by attribute context where Erubi only calls to_s" do
      template = <<~ERB
        <img src="photo.jpg" alt="Photo">
        <br>
        <input type="text" name="<%= field_name %>">
      ERB

      herb, erubi = assert_diverges_from_erubi(template)

      assert_includes herb, "::Herb::Engine.attr((field_name))"
      assert_includes erubi, "( field_name ).to_s"

      injection = 'a" onload="alert(1)'

      assert_includes evaluate(erubi, field_name: injection), injection
      refute_includes evaluate(herb, field_name: injection), injection
    end

    test "escapes inside a script element by script context where Erubi only calls to_s" do
      template = <<~ERB
        <script>
        <![CDATA[
          var data = <%= data %>;
        ]]>
        </script>
      ERB

      herb, erubi = assert_diverges_from_erubi(template)

      assert_includes herb, "::Herb::Engine.js((data))"
      assert_includes erubi, "( data ).to_s"

      injection = "</script>"

      assert_includes evaluate(erubi, data: injection), "var data = </script>;"
      refute_includes evaluate(herb, data: injection), "var data = </script>;"
      assert_includes evaluate(herb, data: injection), "var data = \\x3c/script\\x3e;"
    end

    test "differs only by padding and the escape module across a whole template" do
      template = <<~ERB
        <table>
         <tbody>
          <% i = 0
             list.each_with_index do |item, i| %>
          <tr>
           <td><%= i+1 %></td>
           <td><%== item %></td>
          </tr>
         <% end %>
         </tbody>
        </table>
        <%== i+1 %>
      ERB

      herb, erubi = assert_diverges_from_erubi(template)

      assert_equal herb, with_herb_escape_module(without_expression_padding(erubi))
    end

    test "puts the line a comment took somewhere else than erubi does" do
      template = <<~ERB
        <!DOCTYPE html>
        <html>
        <head>
          <title><%= @title %></title>
        </head>
        <body>
          <% if @user %>
            <h1>Welcome <%= @user.name %>!</h1>
          <% end %>
          <%# This comment should not appear %>
        </body>
        </html>
      ERB

      assert_diverges_from_erubi(template)

      assert_renders_the_same_as_erubi(template)
    end

    test "separates a preamble that Erubi runs into the first append" do
      options = { preamble: "@buf = []", postamble: "@buf.join" }
      herb, erubi = assert_diverges_from_erubi("<div><%= title %></div>", options)

      assert_includes herb, "@buf = [];"
      assert_includes erubi, "@buf = [] _buf"

      RubyVM::InstructionSequence.compile(herb)

      assert_raises(SyntaxError) { RubyVM::InstructionSequence.compile(erubi) }
    end

    test "compiles a case split across tags with trim: false where Erubi produces invalid Ruby" do
      template = "<% case a %>\n<% when 1 %>\nA\n<% end %>\n"
      herb, erubi = assert_diverges_from_erubi(template, { trim: false })

      assert_equal "\nA\n\n", evaluate(herb, { a: 1 })

      assert_raises(SyntaxError) { RubyVM::InstructionSequence.compile(erubi) }
    end

    test "refuses an escaped ERB tag that Erubi passes through" do
      template = "<%% literal %>\n"

      assert_includes Erubi::Engine.new(template).src, "'<% literal %>"

      assert_raises(Herb::Engine::GeneratorTemplateError) { Herb::Engine.new(template) }
    end

    test "refuses a case with its first condition in the same tag that Erubi compiles" do
      template = <<~ERB
        <% case animal
        when "cat" %>
          <p>You chose a cat!</p>
        <% end %>
      ERB

      assert_includes Erubi::Engine.new(template).src, "case animal\nwhen \"cat\""

      assert_raises(Herb::Engine::ParseError) { Herb::Engine.new(template) }

      assert_equal Erubi::Engine.new(template).src, Herb::Engine.new(template, parser_options: { strict: false }).src
    end

    test "compiles a block expression that Erubi turns into invalid Ruby" do
      template = "<%= wrapper do %>\n  <p>hi</p>\n<% end %>\n"
      herb, erubi = assert_diverges_from_erubi(template)

      RubyVM::InstructionSequence.compile(herb)

      assert_raises(SyntaxError) { RubyVM::InstructionSequence.compile(erubi) }
    end
  end
end
