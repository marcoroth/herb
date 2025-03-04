# frozen_string_literal: true

require_relative "../test_helper"

module Lexer
  class LexerTest < Minitest::Spec
    include SnapshotUtils

    test "nil" do
      assert_lexed_snapshot(nil)
    end

    test "empty file" do
      assert_lexed_snapshot("")
    end

    test "lex_file" do
      file = Tempfile.new
      file.write(%(<h1><%= RUBY_VERSION %></h1>))
      file.rewind

      result = ERBX.lex_file(file.path)

      snapshot = <<~SNAPSHOT
        #<ERBX::Token type="TOKEN_HTML_TAG_START" value="<" range=[0, 1] start=1:0 end=1:1>
        #<ERBX::Token type="TOKEN_IDENTIFIER" value="h1" range=[1, 3] start=1:1 end=1:3>
        #<ERBX::Token type="TOKEN_HTML_TAG_END" value=">" range=[3, 4] start=1:3 end=1:4>
        #<ERBX::Token type="TOKEN_ERB_START" value="<%=" range=[4, 7] start=1:4 end=1:7>
        #<ERBX::Token type="TOKEN_ERB_CONTENT" value=" RUBY_VERSION " range=[7, 21] start=1:7 end=1:21>
        #<ERBX::Token type="TOKEN_ERB_END" value="%>" range=[21, 23] start=1:21 end=1:23>
        #<ERBX::Token type="TOKEN_HTML_TAG_START_CLOSE" value="</" range=[23, 25] start=1:23 end=1:25>
        #<ERBX::Token type="TOKEN_IDENTIFIER" value="h1" range=[25, 27] start=1:25 end=1:27>
        #<ERBX::Token type="TOKEN_HTML_TAG_END" value=">" range=[27, 28] start=1:27 end=1:28>
        #<ERBX::Token type="TOKEN_EOF" value="" range=[28, 28] start=1:28 end=1:28>
      SNAPSHOT

      assert_equal snapshot, result.value.inspect

      file.unlink
    end
  end
end
