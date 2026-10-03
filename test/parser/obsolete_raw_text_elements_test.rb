# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ObsoleteRawTextElementsTest < Minitest::Spec
    include SnapshotUtils

    test "xmp with markup inside" do
      assert_parsed_snapshot(%(<xmp><b>bold</b> &amp; more</xmp><i>after</i>))
    end

    test "noembed with markup inside" do
      assert_parsed_snapshot(%(<embed src="movie.swf"><noembed><img src="still.png"></noembed>))
    end

    test "noframes with markup inside" do
      assert_parsed_snapshot(%(<frameset><frame src="a.html"><noframes><p>No frames</p></noframes></frameset>))
    end

    test "plaintext runs to the end of the document" do
      assert_parsed_snapshot(<<~HTML)
        <p>before</p>
        <plaintext>
        <b>not bold</b>
        </plaintext>
        <p>still plaintext</p>
      HTML
    end

    test "plaintext in an xml document is an ordinary element" do
      assert_parsed_snapshot(<<~XML)
        <?xml version="1.0" encoding="utf-8"?>
        <unattend>
          <PlainText>false</PlainText>
          <Value><%= password %></Value>
        </unattend>
      XML
    end
  end
end
