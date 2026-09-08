# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class IframeTest < Minitest::Spec
    include SnapshotUtils

    test "empty iframe with attributes" do
      assert_parsed_snapshot(%(<iframe src="https://example.com/embed" width="560" height="315" allowfullscreen></iframe>))
    end

    test "iframe with ERB in an attribute" do
      assert_parsed_snapshot(%(<iframe src="<%= embed_url %>" title="<%= video.title %>"></iframe>))
    end

    test "iframe with fallback markup" do
      assert_parsed_snapshot(%(<iframe src="/embed"><p>Your browser does not support <a href="/embed">frames</a>.</p></iframe>))
    end

    test "iframe with ERB in the fallback" do
      assert_parsed_snapshot(%(<iframe src="/embed"><%= t(".no_frames") %></iframe>))
    end

    test "iframe with an uppercase closing tag" do
      assert_parsed_snapshot(%(<iframe>text</IFRAME>))
    end

    test "unclosed iframe swallows the rest of the document" do
      assert_parsed_snapshot(<<~HTML)
        <iframe src="/embed">
        <p>after</p>
      HTML
    end
  end
end
