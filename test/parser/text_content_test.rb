# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TextContentTest < Minitest::Spec
    include SnapshotUtils

    test "text content" do
      assert_parsed_snapshot("Hello World")
    end

    test "text content inside tag" do
      assert_parsed_snapshot("<h1>Hello World</h1>")
    end

    test "text content with tag after" do
      assert_parsed_snapshot("Hello<span>World</span>")
    end

    test "text content with tag before" do
      assert_parsed_snapshot("<span>Hello</span>World")
    end

    test "text content with tag around" do
      assert_parsed_snapshot("Hello<span></span>World")
    end

    test "text content that exceeds initial hb_buffer_T size (ca. 4K)" do
      initial_hb_buffer_capacity = 1024 # bytes
      content = cyclic_string((((initial_hb_buffer_capacity * 2) + 1) * 2) + 1)
      result = assert_parsed_snapshot(%(<div>#{content}</div>))

      assert_equal content, result.value.children.first.body.first.content
    end

    test "text content that exceeds initial hb_buffer_T size (ca. 8K)" do
      initial_hb_buffer_capacity = 1024 # bytes
      content = cyclic_string((((((initial_hb_buffer_capacity * 2) + 1) * 2) + 1) * 2) + 1)
      result = assert_parsed_snapshot(%(<div>#{content}</div>))

      assert_equal content, result.value.children.first.body.first.content
    end

    test "exclamation as only content" do
      assert_parsed_snapshot("<b>!</b>")
    end

    test "comma as only content" do
      assert_parsed_snapshot("<b>,</b>")
    end

    test "dollar sign as only content" do
      assert_parsed_snapshot("<b>$</b>")
    end

    test "dash as only content" do
      assert_parsed_snapshot("<b>-</b>")
    end

    test "period as only content" do
      assert_parsed_snapshot("<b>.</b>")
    end

    test "percent as only content" do
      assert_parsed_snapshot("<b>%</b>")
    end

    test "slash as only content" do
      assert_parsed_snapshot("<b>/</b>")
    end

    test "underscore as only content" do
      assert_parsed_snapshot("<b>_</b>")
    end

    test "colon as only content" do
      assert_parsed_snapshot("<b>:</b>")
    end

    test "semicolon as only content" do
      assert_parsed_snapshot("<b>;</b>")
    end

    test "ampersand as only content" do
      assert_parsed_snapshot("<b>&</b>")
    end

    test "equals as only content" do
      assert_parsed_snapshot("<b>=</b>")
    end

    test "a-umlaut as only content" do
      assert_parsed_snapshot("<b>ä</b>")
    end

    test "o-umlaut as only content" do
      assert_parsed_snapshot("<b>ö</b>")
    end

    test "u-umlaut as only content" do
      assert_parsed_snapshot("<b>ü</b>")
    end

    test "emoji as only content" do
      assert_parsed_snapshot("<b>🌿</b>")
    end

    test "non-breaking space (U+00A0) as only content" do
      assert_parsed_snapshot("<b> </b>")
    end

    test "non-breaking space mixed with ERB - issue 310" do
      assert_parsed_snapshot("<p><%= hello %> !</p>")
    end

    test "multiple non-breaking spaces in text" do
      assert_parsed_snapshot("<p>Hello   World</p>")
    end

    test "non-breaking space in attribute value" do
      assert_parsed_snapshot('<div title="Hello World">Content</div>')
    end

    test "at symbol (@) in text content - issue 285" do
      assert_parsed_snapshot("<p>Did we get it wrong? Respond with <em>@reverse</em> to remove the receipt.</p>")
    end

    test "at symbol at beginning of text" do
      assert_parsed_snapshot("<span>@username</span>")
    end

    test "multiple at symbols in text" do
      assert_parsed_snapshot("<p>Email me @john@example.com</p>")
    end

    test "at symbol mixed with ERB" do
      assert_parsed_snapshot("<p>Contact <%= user.name %> @support</p>")
    end

    test "at symbol in attribute value" do
      assert_parsed_snapshot('<a href="mailto:support@example.com">Contact @support</a>')
    end

    test "backtick with HTML tags - issue 467" do
      assert_parsed_snapshot("a `<b></b>` c")
    end

    test "backslash-prefixed text stays literal - issue 635" do
      assert_parsed_snapshot("<p>\\Asome-regexp\\z</p>")
    end

    # https://github.com/lobsters/lobsters/blob/75f9a53077d5aeaeadbb8271def0479dd8fcd761/app/views/domains/edit.html.erb#L11
    test "backslash-prefixed text - issue 633" do
      assert_parsed_snapshot <<~HTML
        <p class="help">Regexp with captures, must consume whole string like: <kbd>\\Ahttps?://github.com/+([^/]+).*\\z</kbd></p>
      HTML
    end

    test "greater than sign as text content - issue 914" do
      assert_parsed_snapshot("<kbd>></kbd>")
    end

    test "greater than sign in text content" do
      assert_parsed_snapshot("<p>5 > 3</p>")
    end

    test "multiple greater than signs in text content" do
      assert_parsed_snapshot("<code>a >> b</code>")
    end

    test "greater than sign at start of text content" do
      assert_parsed_snapshot("<span>> quote</span>")
    end

    test "less than sign as text content" do
      assert_parsed_snapshot("<kbd><</kbd>")
    end

    test "less than sign in text content" do
      assert_parsed_snapshot("<p>5 < 3</p>")
    end

    test "multiple less than signs in text content" do
      assert_parsed_snapshot("<code><<</code>")
    end

    test "less than sign at start of text content" do
      assert_parsed_snapshot("<span>< quote</span>")
    end

    test "less than and greater than in text content" do
      assert_parsed_snapshot("<p>a < b > c</p>")
    end

    test "arrow in text content" do
      assert_parsed_snapshot("<span>a -> b</span>")
    end

    test "generic syntax in text content" do
      assert_parsed_snapshot("<code>Array<String></code>")
    end

    test "less than followed by space" do
      assert_parsed_snapshot("<p>< /span></p>")
    end

    test "less than followed by number" do
      assert_parsed_snapshot("<p><5</p>")
    end

    test "triple less than" do
      assert_parsed_snapshot("<code><<<</code>")
    end

    test "heredoc style" do
      assert_parsed_snapshot("<code><<~HTML</code>")
    end

    test "bit shift operators" do
      assert_parsed_snapshot("<code>x << 2 >> 1</code>")
    end

    test "spaceship operator" do
      assert_parsed_snapshot("<code>a <=> b</code>")
    end

    test "not equal operator" do
      assert_parsed_snapshot("<code>a <> b</code>")
    end

    test "less than or equal" do
      assert_parsed_snapshot("<code>a <= b</code>")
    end

    test "greater than or equal" do
      assert_parsed_snapshot("<code>a >= b</code>")
    end

    test "xml-like content in code" do
      assert_parsed_snapshot("<code><foo></code>")
    end

    test "template literal style" do
      assert_parsed_snapshot("<code>${value}</code>")
    end
  end
end
