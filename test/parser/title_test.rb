# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class TitleTest < Minitest::Spec
    include SnapshotUtils

    test "title with plain text" do
      assert_parsed_snapshot(%(<head><title>Hello</title></head>))
    end

    test "title with HTML elements inside" do
      assert_parsed_snapshot(%(<title>a <b>bold</b> title</title>))
    end

    test "title with ERB output" do
      assert_parsed_snapshot(%(<head><title><%= page_title %> | App</title></head>))
    end

    test "title with ERB control flow" do
      assert_parsed_snapshot(%(<title><% if @page_title %><%= @page_title %><% else %>App<% end %></title>))
    end

    test "title with an uppercase closing tag" do
      assert_parsed_snapshot(%(<title>text</TITLE>))
    end

    test "unclosed title" do
      assert_parsed_snapshot(%(<title>never closed<div>))
    end

    test "svg title keeps its elements" do
      assert_parsed_snapshot(%(<svg><title>Icon <tspan>x</tspan></title><path d="M0 0"/></svg>))
    end

    test "html title after an svg is text again" do
      assert_parsed_snapshot(%(<svg><title>Icon</title></svg><title>a <b>bold</b></title>))
    end

    test "title in an xml document keeps its elements" do
      assert_parsed_snapshot(<<~XML)
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <title><%= @feed.title %></title>
            <item><title>Post <b>one</b></title></item>
          </channel>
        </rss>
      XML
    end
  end
end
