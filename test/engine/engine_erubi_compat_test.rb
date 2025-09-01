# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class EngineErubiCompatTest < Minitest::Spec
    test "handles no tags" do
      template = "a\n"
      engine = Herb::Engine.new(template)

      assert_includes engine.src, "_buf << 'a"
      assert_includes engine.src, "_buf.to_s"
    end

    test "handles basic erb expressions" do
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

      engine = Herb::Engine.new(template)

      assert_includes engine.src, "i = 0"
      assert_includes engine.src, "list.each_with_index do |item, i|"

      assert_includes engine.src, "(i+1).to_s"
      assert_includes engine.src, "::Herb::Engine.h((item))"
      assert_includes engine.src, "::Herb::Engine.h((i+1))"
    end

    test "escapes backslashes and apostrophes in text" do
      template = "<table>\n <tbody>' ' \\\\ \\\\\n</tbody>\n</table>"
      engine = Herb::Engine.new(template)

      assert_includes engine.src, "\\' \\'"
      assert_includes engine.src, "\\\\\\\\"
    end

    test "strips whitespace with -%> tag" do
      template = <<~ERB
        <% a = 1 -%>
        text
      ERB

      engine = Herb::Engine.new(template)

      assert_includes engine.src, "a = 1"
      assert_includes engine.src, "_buf << 'text"
      refute_includes engine.src, "_buf << '\\ntext"
    end

    test "handles erb comments" do
      template = <<~ERB
        <%# This is a comment %>
        <div>Content</div>
      ERB

      engine = Herb::Engine.new(template)

      refute_includes engine.src, "This is a comment"
      assert_includes engine.src, "<div>Content</div>"
    end

    test "handles escape option" do
      template = "<%= content %>"

      engine = Herb::Engine.new(template, escape: true)
      assert_includes engine.src, "__herb = ::Herb::Engine"
      assert_includes engine.src, "__herb.h((content))"

      engine = Herb::Engine.new(template, escape: false)
      assert_includes engine.src, "(content).to_s"
      refute_includes engine.src, "::Herb::Engine.h"
    end

    test "handles double equals for inverse escaping" do
      template = "<%== content %>"

      engine = Herb::Engine.new(template, escape: true)
      assert_includes engine.src, "(content).to_s"
      refute_includes engine.src, "__herb.h"

      engine = Herb::Engine.new(template, escape: false)
      assert_includes engine.src, "::Herb::Engine.h((content))"
    end

    test "handles custom bufvar" do
      template = "<div>Test</div>"
      engine = Herb::Engine.new(template, bufvar: "@output")

      assert_includes engine.src, "@output = ::String.new"
      assert_includes engine.src, "@output << '"
      assert_includes engine.src, "@output.to_s"
    end

    test "handles freeze option" do
      template = "<div>Static content</div>"
      engine = Herb::Engine.new(template, freeze: true)

      assert_includes engine.src, "# frozen_string_literal: true"
      assert_includes engine.src, "'.freeze"
    end

    test "handles freeze_template_literals option" do
      template = "<div>Content</div>"

      engine = Herb::Engine.new(template)
      assert_includes engine.src, "'.freeze"

      engine = Herb::Engine.new(template, freeze_template_literals: false)
      refute_includes engine.src, "'.freeze"
    end

    test "handles custom preamble and postamble" do
      template = "<div>Test</div>"
      engine = Herb::Engine.new(template,
                                preamble: "@buf = []",
                                postamble: "@buf.join")

      assert_includes engine.src, "@buf = []"
      assert_includes engine.src, "@buf.join"
    end

    test "handles ensure option" do
      template = "<div>Test</div>"
      engine = Herb::Engine.new(template, ensure: true)

      assert_includes engine.src, "begin; __original_outvar = _buf"
      assert_includes engine.src, "; ensure"
      assert_includes engine.src, "_buf = __original_outvar"
      assert_includes engine.src, "end"
    end

    test "handles custom escapefunc" do
      template = "<%== content %>"
      engine = Herb::Engine.new(template,
                                escape: false,
                                escapefunc: "CGI.escapeHTML")

      assert_includes engine.src, "CGI.escapeHTML((content))"
      refute_includes engine.src, "::Herb::Engine.h"
    end

    test "handles chain_appends option" do
      template = <<~ERB
        <%= a %>
        <%= b %>
      ERB

      engine = Herb::Engine.new(template, chain_appends: true)
      assert_includes engine.src, "; _buf"

      engine = Herb::Engine.new(template, chain_appends: false)
      assert_includes engine.src, "_buf << ("
      assert_includes engine.src, ").to_s;"
    end

    test "handles multiple erb constructs in complex template" do
      template = <<~ERB
        <!DOCTYPE html>
        <html>
        <head>
          <title><%= @title %></title>
        </head>
        <body>
          <% if @user %>
            <h1>Welcome <%= @user.name %>!</h1>
            <% @user.posts.each do |post| %>
              <article>
                <h2><%== post.title %></h2>
                <div><%= post.content %></div>
              </article>
            <% end %>
          <% else %>
            <p>Please log in</p>
          <% end %>
          <%# This comment should not appear %>
        </body>
        </html>
      ERB

      engine = Herb::Engine.new(template)

      assert_includes engine.src, "<!DOCTYPE html>"
      assert_includes engine.src, "if @user"
      assert_includes engine.src, "@user.posts.each do |post|"
      assert_includes engine.src, "(@title).to_s"
      assert_includes engine.src, "(@user.name).to_s"
      assert_includes engine.src, "::Herb::Engine.h((post.title))"
      assert_includes engine.src, "(post.content).to_s"
      assert_includes engine.src, "else"
      assert_includes engine.src, "Please log in"
      refute_includes engine.src, "This comment should not appear"
    end

    test "handles void elements correctly" do
      template = <<~ERB
        <img src="photo.jpg" alt="Photo">
        <br>
        <input type="text" name="<%= field_name %>">
      ERB

      engine = Herb::Engine.new(template)

      assert_includes engine.src, '<img src="photo.jpg" alt="Photo">'
      assert_includes engine.src, "<br>"
      assert_includes engine.src, '<input type="text" name="'
      assert_includes engine.src, "::Herb::Engine.attr((field_name))"
    end

    test "handles CDATA sections" do
      template = <<~ERB
        <script>
        <![CDATA[
          var data = <%= @data.to_json %>;
        ]]>
        </script>
      ERB

      engine = Herb::Engine.new(template)

      assert_includes engine.src, "<![CDATA["
      assert_includes engine.src, "]]>"
      assert_includes engine.src, "::Herb::Engine.js((@data.to_json))"
    end

    test "handles XML declarations" do
      template = '<?xml version="1.0" encoding="UTF-8"?>'
      engine = Herb::Engine.new(template)

      assert_includes engine.src, '<?xml version="1.0" encoding="UTF-8"?>'
    end
  end
end
