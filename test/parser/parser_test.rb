# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ParserTest < Minitest::Spec
    include SnapshotUtils

    test "nil" do
      assert_parsed_snapshot(nil)
    end

    test "empty file" do
      assert_parsed_snapshot("")
    end

    test "parse_file" do
      file = Tempfile.new
      file.write(%(<h1><%= RUBY_VERSION %></h1>))
      file.rewind

      result = Herb.parse_file(file.path)

      assert_equal <<~SNAPSHOT.chomp, result.value.inspect
        @ DocumentNode (location: (1:0)-(1:28))
        └── children: (1 item)
            └── @ HTMLElementNode (location: (1:0)-(1:28))
                ├── open_tag:
                │   └── @ HTMLOpenTagNode (location: (1:0)-(1:4))
                │       ├── tag_opening: "<" (location: (1:0)-(1:1))
                │       ├── tag_name: "h1" (location: (1:1)-(1:3))
                │       ├── tag_closing: ">" (location: (1:3)-(1:4))
                │       ├── children: []
                │       └── is_void: false
                │
                ├── tag_name: "h1" (location: (1:1)-(1:3))
                ├── body: (1 item)
                │   └── @ ERBContentNode (location: (1:4)-(1:23))
                │       ├── tag_opening: "<%=" (location: (1:4)-(1:7))
                │       ├── content: " RUBY_VERSION " (location: (1:7)-(1:21))
                │       ├── tag_closing: "%>" (location: (1:21)-(1:23))
                │       ├── parsed: false
                │       └── valid: false
                │
                ├── close_tag:
                │   └── @ HTMLCloseTagNode (location: (1:23)-(1:28))
                │       ├── tag_opening: "</" (location: (1:23)-(1:25))
                │       ├── tag_name: "h1" (location: (1:25)-(1:27))
                │       ├── children: []
                │       └── tag_closing: ">" (location: (1:27)-(1:28))
                │
                ├── is_void: false
                └── source: "HTML"
      SNAPSHOT

      file.unlink
    end
  end
end
