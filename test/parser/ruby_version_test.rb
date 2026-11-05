# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class RubyVersionTest < Minitest::Spec
    include SnapshotUtils

    test "ruby_version is unset by default" do
      assert_nil Herb::ParserOptions.new.ruby_version
      assert_nil Herb.parse("<%= user %>").options.ruby_version
    end

    test "ruby_version reaches the parse result" do
      assert_equal "3.4", Herb.parse("<%= user %>", ruby_version: "3.4").options.ruby_version
    end

    test "ruby_version accepts a full version" do
      assert_equal "3.4.2", Herb.parse("<%= user %>", ruby_version: "3.4.2").options.ruby_version
    end

    test "Ruby 4.1 syntax is valid by default" do
      assert_parsed_snapshot(<<~HTML)
        <% def greet(name,) = name %>
      HTML
    end

    test "Ruby 4.1 syntax is invalid for an older ruby_version" do
      assert_parsed_snapshot(<<~HTML, ruby_version: "3.4")
        <% def greet(name,) = name %>
      HTML
    end

    test "unsupported ruby_version raises" do
      error = assert_raises(ArgumentError) { Herb.parse("<%= user %>", ruby_version: "2.7") }

      assert_equal 'ruby_version "2.7" is not supported', error.message
    end

    test "non-string ruby_version raises" do
      assert_raises(TypeError) { Herb.parse("<%= user %>", ruby_version: 3.4) }
    end
  end
end
