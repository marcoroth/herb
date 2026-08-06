# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ErrorRecoveryTest < Minitest::Spec
    include SnapshotUtils

    test "detects unclosed div tag when new tag starts" do
      assert_parsed_snapshot(%(<div class="foo"<span>))
    end

    test "unclosed tag at EOF doesn't create HTMLElementNode" do
      assert_parsed_snapshot(%(<div <div))
    end

    test "unclosed tag at EOF with space doesn't create HTMLElementNode" do
      assert_parsed_snapshot(%(<div> <div))
    end

    test "continues parsing after unclosed open tag error" do
      assert_parsed_snapshot(%(<a href="test"<b>text</b></a>))
    end

    test "detects unclosed tag with multiple attributes" do
      assert_parsed_snapshot(%(<input type="text" name="field"<span>content</span>))
    end

    test "detects unclosed quote when new attribute starts" do
      assert_parsed_snapshot(%(<div class="foo title="bar">))
    end

    test "detects unclosed single quote reaching tag end" do
      assert_parsed_snapshot(%(<div class='test>content</div>))
    end

    test "detects unclosed double quote reaching tag end" do
      assert_parsed_snapshot(%(<div class="test>content</div>))
    end

    test "handles unclosed quote with self-closing tag" do
      assert_parsed_snapshot(%(<img src="image.jpg />))
    end

    test "unclosed ERB tag at EOF" do
      assert_parsed_snapshot(%(<%= foo))
    end

    test "unclosed ERB comment at EOF" do
      assert_parsed_snapshot(%(<%# comment))
    end

    test "nested ERB tag inside ERB comment" do
      assert_parsed_snapshot(%(<%# Another comment with <%= "erb" %> inside %>))
    end

    test "multiple error types in single template" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <span class="unclosed
          <p>content</p>
        </span>
        </div>
      HTML
    end

    test "recovery with ERB content" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar %>
          <%= content %>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute value without closing quote" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar
          <%= content %>
        </div>
      HTML
    end

    test "closed ERB tag in attribute missing tag closing" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar %>"
          <%= content %>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute value with space before quote" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar ">
          <%= content %>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute value without space before quote" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar">
          <%= content %>
        </div>
      HTML
    end

    test "closed ERB tag in attribute with extra closing angle bracket" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar %>>
          <%= content %>
        </div>
      HTML
    end

    test "nested unclosed tags with recovery" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <span class="test
          <em>emphasized</em>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute position at EOF" do
      assert_parsed_snapshot(%(<input <%= tag.attributes(type: :text) %))
    end

    test "unclosed HTML tag after ERB tag in attribute position at EOF" do
      assert_parsed_snapshot(%(<input <%= tag.attributes(type: :text) %>))
    end

    test "ERB output tag closed with > instead of %>" do
      assert_parsed_snapshot(%(<%= user >))
    end

    test "ERB output tag closed with > instead of %> inside an element" do
      assert_parsed_snapshot(<<~HTML)
        <% @users.each do |user| %>
          <p><%= user ></p>
        <% end %>
      HTML
    end

    test "ERB block opening tag closed with > instead of %>" do
      assert_parsed_snapshot(<<~HTML)
        <% @users.each do |user| >
          <p><%= user %></p>
        <% end %>
      HTML
    end

    test "ERB end tag closed with > instead of %>" do
      assert_parsed_snapshot(<<~HTML)
        <% if admin? %>
          <p>admin</p>
        <% end >
      HTML
    end

    test "consecutive ERB tags closed with > instead of %>" do
      assert_parsed_snapshot(<<~HTML)
        <p><%= first ></p>
        <p><%= second ></p>
      HTML
    end

    test "ERB tag closed with > instead of %> keeps greater-than comparison in the Ruby" do
      assert_parsed_snapshot(%(<p><%= count > 10 ></p>))
    end

    test "ERB tag closed with > instead of %> at the end of an attribute value" do
      assert_parsed_snapshot(%(<div class="<%= classes >">content</div>))
    end

    test "unclosed ERB tag is not recovered when no > leaves parseable Ruby behind" do
      assert_parsed_snapshot(%(<%= items.select { |item| item.size > 3 ))
    end

    test "ERB tag without any closing delimiter before a closing HTML tag" do
      assert_parsed_snapshot(%(<h1><%= title </h1>))
    end

    test "ERB tag without any closing delimiter before an opening HTML tag" do
      assert_parsed_snapshot(<<~HTML)
        <%= title
        <p>content</p>
      HTML
    end

    test "ERB tag without any closing delimiter inside a block" do
      assert_parsed_snapshot(<<~HTML)
        <% @users.each do |user| %>
          <h1><%= user.name </h1>
        <% end %>
      HTML
    end

    test "ERB tag without any closing delimiter is not cut at a closing tag inside a Ruby string" do
      assert_parsed_snapshot(%(<p><%= tag("</p>") </p>))
    end

    test "ERB output tag closed with % instead of %>" do
      assert_parsed_snapshot(%(<h1><%= title %</h1>))
    end

    test "ERB block opening tag closed with % instead of %>" do
      assert_parsed_snapshot(<<~HTML)
        <% @users.each do |user| %
          <p><%= user %></p>
        <% end %>
      HTML
    end

    test "ERB tag closed with trimming delimiter missing its closing angle bracket" do
      assert_parsed_snapshot(%(<h1><%= title -%</h1>))
    end

    test "ERB tag closed with a space between % and >" do
      assert_parsed_snapshot(%(<h1><%= title % ></h1>))
    end

    test "ERB tag closed with transposed >%" do
      assert_parsed_snapshot(%(<h1><%= title >%</h1>))
    end

    test "ERB tag in attribute value closed with % instead of %>" do
      assert_parsed_snapshot(%(<div class="<%= classes %">content</div>))
    end

    test "ERB comment closed with % instead of %>" do
      assert_parsed_snapshot(%(<h1><%# note %</h1>))
    end

    test "ERB tag without any closing delimiter before an HTML comment" do
      assert_parsed_snapshot(%(<%= foo <!-- comment -->))
    end

    test "ERB tag without any closing delimiter cuts at the first HTML tag" do
      assert_parsed_snapshot(%(<div><%= foo <b>a</b><b>b</b><b>c</b></div>))
    end

    test "ERB tag closed with % at the end of a CRLF line" do
      assert_parsed_snapshot("<% users.each do |user| %\r\n  <p>x</p>\r\n<% end %>\r\n")
    end

    test "ERB tag closed with =% instead of =%>" do
      assert_parsed_snapshot(%(<h1><%= title =%</h1>))
    end

    test "escaped ERB tag closed with %% instead of %%>" do
      assert_parsed_snapshot(%(<h1><%% title %%</h1>))
    end
  end
end
