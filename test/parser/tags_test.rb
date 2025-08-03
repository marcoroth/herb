# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TagsTest < Minitest::Spec
    include SnapshotUtils

    test "empty tag" do
      assert_parsed_snapshot("<span></span>")
    end

    test "empty tag with whitespace" do
      assert_parsed_snapshot("<span> </span>")
    end

    test "empty tag with newline" do
      assert_parsed_snapshot("<span>\n</span>")
    end

    test "void element shouldn't expect a closing tag" do
      assert_parsed_snapshot("<br>")
    end

    test "void element with open and close tag" do
      assert_parsed_snapshot("<br></br>")
    end

    test "br self-closing tag" do
      assert_parsed_snapshot("<br/>")
    end

    test "closing tag without an opening tag for a void element" do
      assert_parsed_snapshot(%(</br>))
    end

    test "closing tag without an opening tag for a non-void element" do
      assert_parsed_snapshot(%(</div>))
    end

    test "multiple closing tags without opening tags" do
      assert_parsed_snapshot(%(</div></div></span>))
    end

    test "basic tag" do
      assert_parsed_snapshot(%(<html></html>))
    end

    test "mismatched closing tag" do
      assert_parsed_snapshot(%(<html></div>))
    end

    test "nested tags" do
      assert_parsed_snapshot(%(<div><h1>Hello<span>World</span></h1></div>))
    end

    test "basic void tag" do
      assert_parsed_snapshot("<img />")
    end

    test "basic void tag without whitespace" do
      assert_parsed_snapshot("<img/>")
    end

    test "namespaced tag" do
      assert_parsed_snapshot("<ns:table></ns:table>")
    end

    test "colon inside html tag" do
      assert_parsed_snapshot(%(<div : class=""></div>))
    end

    test "link tag" do
      assert_parsed_snapshot(%(<link href="https://mywebsite.com/style.css" rel="stylesheet">))
    end

    test "element has a self-closing tag for a void element at the position where closing tag of parent is expected" do
      assert_parsed_snapshot(%(<div></br></div>))
    end

    test "multiple void elements shouldn't expect a closing tag" do
      assert_parsed_snapshot(%(<br><input><br><input>))
    end

    test "too many closing tags" do
      assert_parsed_snapshot(%(<div></div></div>))
    end

    test "missing closing tag" do
      assert_parsed_snapshot(%(<div><span><p></p></div>))
    end

    test "missing multiple closing tags" do
      assert_parsed_snapshot(%(<div><span><p></p>))
    end

    test "should recover from out of order closing tags" do
      assert_parsed_snapshot(%(
        <main>
          <div>
            </span>
          </div>
        </main>
      ))
    end

    # TODO: ideal parse result
    #
    # - match up the <main> and <div> tags
    # - <p> should have a missing closing tag
    # - </span> should have a missing opening tag
    # - </p> should have a missing opening tag
    # - no other errors
    #
    test "should recover from multiple out of order closing tags" do
      skip
      assert_parsed_snapshot(%(
        <main>
          <div>
            <p>
              </span>
            </div>
          </p>
        </main>
      ))
    end

    test "should recover from void elements used as closing tag" do
      assert_parsed_snapshot(%(
        <main>
          <div>
            </br>
            <span>Hello</span>
            <p>World</p>
          </div>
        </main>
      ))
    end

    # TODO: ideal parse result
    #
    # - matched up <main> and <div> tags
    # - </br> VoidElementClosingTagError
    # - </br> VoidElementClosingTagError
    # - no other errors
    #
    test "should recover from multiple void elements used as closing tag" do
      skip
      assert_parsed_snapshot(%(
        <main>
          <div>
            </br>
            <span>Hello</span>
            </br>
            <p>World</p>
          </div>
        </main>
      ))
    end

    test "stray closing tag with whitespace" do
      assert_parsed_snapshot(%(<div>Hello</div>< /span>))
    end

    test "script tag with nested div" do
      skip
      assert_parsed_snapshot(%(<script><div>var x = 5;</div></script>))
    end

    test "script tag with JavaScript greater than comparison" do
      skip
      assert_parsed_snapshot(%(<script>if (something > 3) { alert("hello"); }</script>))
    end

    test "script tag with JavaScript less than comparison" do
      skip
      assert_parsed_snapshot(%(<script>if (count < 10) { return true; }</script>))
    end

    test "script tag with HTML-like string literals" do
      skip
      assert_parsed_snapshot(%(<script>var html = "<div class='test'>content</div>";</script>))
    end

    test "script tag with nested script tags in string" do
      skip
      assert_parsed_snapshot(%(<script>document.write('<script>alert("nested")</script>');</script>))
    end

    test "script tag with mixed HTML tags and JavaScript" do
      skip
      assert_parsed_snapshot(%(<script><span>function test() { return x > y; }</span></script>))
    end

    test "style tag with nested div and CSS selectors" do
      skip
      assert_parsed_snapshot(%(<style><div>.class { color: red; }</div></style>))
    end

    test "style tag with CSS greater than selector" do
      skip
      assert_parsed_snapshot(%(<style>.parent > .child { margin: 0; }</style>))
    end

    test "style tag with CSS attribute selectors containing HTML-like content" do
      skip
      assert_parsed_snapshot(%(<style>input[placeholder="<enter text>"] { color: blue; }</style>))
    end

    test "style tag with CSS content property containing HTML" do
      skip
      assert_parsed_snapshot(%(<style>.element::before { content: "<div>Generated</div>"; }</style>))
    end

    test "style tag with media queries and nested rules" do
      skip
      assert_parsed_snapshot(%(<style>@media (max-width: 768px) { .class > .nested { display: none; } }</style>))
    end

    test "script tag with ERB interpolation" do
      skip
      assert_parsed_snapshot(%(<script>var userId = <%= current_user.id %>; if (userId > 0) { login(); }</script>))
    end

    test "style tag with ERB interpolation" do
      skip
      assert_parsed_snapshot(%(<style>.user-<%= user.id %> > .content { color: <%= theme_color %>; }</style>))
    end

    test "empty script tag" do
      assert_parsed_snapshot(%(<script></script>))
    end

    test "empty style tag" do
      assert_parsed_snapshot(%(<style></style>))
    end

    test "self-closing script tag" do
      assert_parsed_snapshot(%(<script />))
    end

    test "self-closing style tag" do
      assert_parsed_snapshot(%(<style />))
    end

    test "script tag with complex JavaScript containing multiple HTML-like patterns" do
      skip
      assert_parsed_snapshot(<<-HTML)
        <script>
          function createElements() {
            const div = "<div class='container'>";

            const span = "<span>text</span>";

            if (elements.length > maxCount) {
              return "<ul><li>Item</li></ul>";
            }

            return div + span + "</div>";
          }
        </script>
      HTML
    end

    test "style tag with complex CSS containing HTML-like selectors" do
      skip
      assert_parsed_snapshot(<<-HTML)
        <style>
          /* CSS comment */

          .component > .header {
            content: "<i class='icon'></i>";
          }

          .component[data-type="<special>"] {
            background: url("data:image/svg+xml,<svg><rect/></svg>");
          }
        </style>
      HTML
    end

    test "closing tag with newline before >" do
      assert_parsed_snapshot(<<-HTML)
        <a href="https://example.com/">Link Text</a
        >
      HTML
    end

    test "closing tag with whitespace and newline before >" do
      assert_parsed_snapshot(<<-HTML)
        <div>Content</div
        >
      HTML
    end

    test "multiple closing tags with newlines before >" do
      assert_parsed_snapshot(<<-HTML)
        <div>
          <span>Text</span
          >
        </div
        >
      HTML
    end

    test "nested tags with newlines in closing tags from issue 312" do
      assert_parsed_snapshot(<<-HTML)
        <div
          id="footer-img"
          class="d-flex align-items-start justify-content-lg-start"
        >
          <a
            href="https://example.com/"
            class="stacked-lg"
            >Link Text</a
          >
        </div>
      HTML
    end

    test "self-closing tag with closing tag having newline before >" do
      assert_parsed_snapshot(<<-HTML)
        <img src="image.jpg" />
        <br></br
        >
      HTML
    end
  end
end
