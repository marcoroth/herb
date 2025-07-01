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

    test "void tag with attributes" do
      assert_parsed_snapshot(%(<img src="/image.png" />))
    end

    test "void tag with multiple attributes" do
      assert_parsed_snapshot(%(<img src="/image.png" alt="description" />))
    end

    test "void tag with erb attribute value" do
      assert_parsed_snapshot(%(<img src="<%= image_path("image.png") %>" />))
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
  end
end
