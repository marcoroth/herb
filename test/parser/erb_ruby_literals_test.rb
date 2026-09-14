# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ERBRubyLiteralsTest < Minitest::Spec
    include SnapshotUtils

    test "single-quoted string containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = '<%' %>))
    end

    test "double-quoted string containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = "<%" %>))
    end

    test "single-quoted string containing balanced erb pair" do
      assert_parsed_snapshot(%q(<% x = '<% ignore %>' %>))
    end

    test "double-quoted string with escaped quote before erb-like content" do
      assert_parsed_snapshot(%q(<% x = "\"<%" %>))
    end

    test "double-quoted string with interpolation followed by erb-like content" do
      assert_parsed_snapshot(%q(<% x = "#{a}<%" %>))
    end

    test "backtick string containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = `<%` %>))
    end

    test "line comment containing erb-like content" do
      assert_parsed_snapshot("<% # <%\n %>")
    end

    test "nested erb tag without ruby string still errors" do
      assert_parsed_snapshot(%q(<%<% %>))
    end

    test "percent-q literal containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = %q{<%} %>))
    end

    test "percent-Q literal containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = %Q(<%) %>))
    end

    test "percent-w literal containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = %w[<%] %>))
    end

    test "bare percent literal containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = %{<%} %>))
    end

    test "regex literal after assignment containing erb-like content" do
      assert_parsed_snapshot(%q(<% x = /<%/ %>))
    end

    test "division not treated as regex" do
      assert_parsed_snapshot(%q(<% x = a / b / c %>))
    end

    test "character literal for angle bracket" do
      assert_parsed_snapshot(%q(<% x = ?< %>))
    end

    test "ternary not treated as character literal" do
      assert_parsed_snapshot(%q(<% n = 1 ? a : b %>))
    end

    test "bareword heredoc containing erb-like content" do
      assert_parsed_snapshot("<% x = <<EOT\n<%\nEOT\n%>")
    end

    test "squiggly heredoc with indented terminator" do
      assert_parsed_snapshot("<% x = <<~EOT\n  <%\n  EOT\n%>")
    end

    test "single-quoted heredoc without interpolation" do
      assert_parsed_snapshot("<% x = <<'EOT'\n<%\nEOT\n%>")
    end
  end
end
