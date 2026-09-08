# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TextareaTest < Minitest::Spec
    include SnapshotUtils

    test "textarea with plain text" do
      assert_parsed_snapshot(%(<textarea>Hello</textarea>))
    end

    test "textarea with an unclosed script tag inside" do
      assert_parsed_snapshot(<<~HTML)
        <textarea class="form-control" onfocus="$(this).select()" readonly>
          <script src='....' type='module' ...>
        </textarea>
      HTML
    end

    test "textarea with HTML elements inside" do
      assert_parsed_snapshot(%(<textarea><b>bold</b> and <input type="text"></textarea>))
    end

    test "textarea with ERB output" do
      assert_parsed_snapshot(%(<textarea name="body"><%= @post.body %></textarea>))
    end

    test "textarea with ERB control flow" do
      assert_parsed_snapshot(<<~HTML)
        <textarea><% if @draft %>Draft<% else %>Final<% end %></textarea>
      HTML
    end

    test "textarea with an uppercase closing tag and trailing whitespace" do
      assert_parsed_snapshot(%(<textarea>text</TEXTAREA >))
    end

    test "textarea with a closing tag for a different element" do
      assert_parsed_snapshot(%(<textarea></div></textarea>))
    end

    test "unclosed textarea" do
      assert_parsed_snapshot(%(<textarea>never closed<div>))
    end

    test "textarea inside a form with sibling elements" do
      assert_parsed_snapshot(<<~HTML)
        <form>
          <label for="body">Body</label>
          <textarea id="body"><p>not an element</p></textarea>
          <button>Save</button>
        </form>
      HTML
    end
  end
end
