# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class EngineErubiCompatTest < Minitest::Spec
    include SnapshotUtils

    test "handles no tags" do
      template = "a\n"

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
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

      assert_compiled_snapshot(template)
    end

    test "escapes backslashes and apostrophes in text" do
      template = "<table>\n <tbody>' ' \\\\ \\\\\n</tbody>\n</table>"

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "strips whitespace with -%> tag" do
      template = <<~ERB
        <% a = 1 -%>
        text
      ERB

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "handles erb comments" do
      template = <<~ERB
        <%# This is a comment %>
        <div>Content</div>
      ERB

      assert_compiled_snapshot(template)
    end

    test "handles escape option" do
      template = "<%= content %>"

      assert_compiled_snapshot(template, { escape: true })
      assert_compiled_snapshot(template, { escape: false })
    end

    test "handles double equals for inverse escaping" do
      template = "<%== content %>"

      assert_compiled_snapshot(template, { escape: true })
      assert_compiled_snapshot(template, { escape: false })
    end

    test "handles custom bufvar" do
      template = "<div>Test</div>"

      assert_compiled_snapshot(template, { bufvar: "@output" }, enforce_erubi_equality: true)
    end

    test "handles freeze option" do
      template = "<div>Static content</div>"

      assert_compiled_snapshot(template, { freeze: true }, enforce_erubi_equality: true)
    end

    test "handles freeze_template_literals option" do
      template = "<div>Content</div>"

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
      assert_compiled_snapshot(template, { freeze_template_literals: false }, enforce_erubi_equality: true)
    end

    test "handles custom preamble and postamble" do
      template = "<div>Test</div>"

      assert_compiled_snapshot(template, { preamble: "@buf = []", postamble: "@buf.join" })
    end

    test "handles ensure option" do
      template = "<div>Test</div>"

      assert_compiled_snapshot(template, { ensure: true }, enforce_erubi_equality: true)
    end

    test "handles custom escapefunc" do
      template = "<%== content %>"

      assert_compiled_snapshot(template, { escape: false, escapefunc: "CGI.escapeHTML" })
    end

    test "handles chain_appends option" do
      template = <<~ERB
        <%= a %>
        <%= b %>
      ERB

      assert_compiled_snapshot(template, { chain_appends: true })
      assert_compiled_snapshot(template, { chain_appends: false })
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

      assert_compiled_snapshot(template)
    end

    test "handles void elements correctly" do
      template = <<~ERB
        <img src="photo.jpg" alt="Photo">
        <br>
        <input type="text" name="<%= field_name %>">
      ERB

      assert_compiled_snapshot(template)
    end

    test "handles CDATA sections" do
      template = <<~ERB
        <script>
        <![CDATA[
          var data = <%= @data.to_json %>;
        ]]>
        </script>
      ERB

      assert_compiled_snapshot(template)
    end

    test "handles XML declarations" do
      template = '<?xml version="1.0" encoding="UTF-8"?>'

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "handles XML processing instructions" do
      template = '<?xml-stylesheet type="text/xsl" href="feed.xsl"?>'

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "handles XML processing instructions with ERB" do
      template = '<?xml-stylesheet type="text/xsl" href="<%= path %>"?>'

      assert_compiled_snapshot(template)
    end

    test "handles empty escaped erb tag" do
      assert_evaluated_snapshot("<%%>", {}, enforce_erubi_equality: true)
    end

    test "handles empty escaped erb tag surrounded by text" do
      assert_evaluated_snapshot("a <%%> b", {}, enforce_erubi_equality: true)
    end

    test "leaves whitespace before a <%- tag alone" do
      template = <<~ERB
        text
          <%- a = 1 %>
        after
      ERB

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "handles case with conditions in separate erb tags" do
      template = <<~ERB
        <% case animal %>
        <% when "cat" %>
          <p>You chose a cat!</p>
        <% when "dog" %>
          <p>You chose a dog!</p>
        <% else %>
          <p>Unknown animal</p>
        <% end %>
      ERB

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "handles case with a trimming tag before the first condition" do
      template = <<~ERB
        <% case animal -%>
        <% when "cat" %>
          <p>You chose a cat!</p>
        <% else %>
          <p>Unknown animal</p>
        <% end %>
      ERB

      assert_compiled_snapshot(template, enforce_erubi_equality: true)
    end

    test "handles case with its first condition in the same erb tag when not strict" do
      template = <<~ERB
        <% case animal
        when "cat" %>
          <p>You chose a cat!</p>
        <% when "dog" %>
          <p>You chose a dog!</p>
        <% else %>
          <p>Unknown animal</p>
        <% end %>
      ERB

      assert_compiled_snapshot(template, parser_options: { strict: false }, enforce_erubi_equality: true)
    end

    test "rejects case with its first condition in the same erb tag when strict" do
      template = <<~ERB
        <% case animal
        when "cat" %>
          <p>You chose a cat!</p>
        <% end %>
      ERB

      error = assert_raises(Herb::Engine::ParseError) do
        Herb::Engine.new(template)
      end

      assert_equal ["ERBCaseWithConditionsError"], error.diagnostics.map(&:code)
    end
  end
end
