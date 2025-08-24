# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class CDATATest < Minitest::Spec
    include SnapshotUtils

    test "basic CDATA section" do
      assert_lexed_snapshot("<![CDATA[]]>")
    end

    test "CDATA with text content" do
      assert_lexed_snapshot("<![CDATA[Hello World]]>")
    end

    test "CDATA with XML-like content" do
      assert_lexed_snapshot("<![CDATA[<sender>John Smith</sender>]]>")
    end

    test "CDATA with special characters" do
      assert_lexed_snapshot("<![CDATA[&lt; &gt; &amp; &#240;]]>")
    end

    test "CDATA with escaped characters that are not interpreted" do
      assert_lexed_snapshot("<![CDATA[<html>&amp; &lt;div&gt;</html>]]>")
    end

    test "CDATA with newlines" do
      assert_lexed_snapshot(<<~XML)
        <![CDATA[
          Line 1
          Line 2
          Line 3
        ]]>
      XML
    end

    test "CDATA in XML document" do
      assert_lexed_snapshot(<<~XML)
        <?xml version="1.0"?>
        <root>
          <data><![CDATA[Some data here]]></data>
        </root>
      XML
    end

    test "CDATA with ERB content" do
      assert_lexed_snapshot("<![CDATA[<%= @variable %>]]>")
    end

    test "CDATA with complex ERB" do
      assert_lexed_snapshot(<<~XML)
        <![CDATA[
          <% if @condition %>
            <%= @content %>
          <% end %>
        ]]>
      XML
    end

    test "Multiple CDATA sections" do
      assert_lexed_snapshot("<![CDATA[First]]><![CDATA[Second]]>")
    end

    test "CDATA with ]] inside (workaround pattern)" do
      assert_lexed_snapshot("<![CDATA[Content with ]]]]><![CDATA[> inside]]>")
    end

    test "CDATA in HTML comment context" do
      assert_lexed_snapshot("<!-- Before --><![CDATA[Data]]><!-- After -->")
    end

    test "CDATA with various brackets" do
      assert_lexed_snapshot("<![CDATA[{[()]}]]>")
    end

    test "Empty CDATA with spaces" do
      assert_lexed_snapshot("<![CDATA[   ]]>")
    end

    test "CDATA followed by HTML" do
      assert_lexed_snapshot("<![CDATA[Data]]><div>HTML</div>")
    end
  end
end
