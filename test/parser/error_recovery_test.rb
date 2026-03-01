# frozen_string_literal: true

require_relative "../test_helper"

module Parser
  class ErrorRecoveryTest < Minitest::Spec
    include SnapshotUtils

    test "detects unclosed div tag when new tag starts" do
      assert_parsed_snapshot(%(<div class="foo"<span>))
    end

    test "unclosed tag at EOF doesn't create HTMLElementNode" do
      assert_parsed_snapshot(%(<div <div))
    end

    test "unclosed tag at EOF with space doesn't create HTMLElementNode" do
      assert_parsed_snapshot(%(<div> <div))
    end

    test "continues parsing after unclosed open tag error" do
      assert_parsed_snapshot(%(<a href="test"<b>text</b></a>))
    end

    test "detects unclosed tag with multiple attributes" do
      assert_parsed_snapshot(%(<input type="text" name="field"<span>content</span>))
    end

    test "detects unclosed quote when new attribute starts" do
      assert_parsed_snapshot(%(<div class="foo title="bar">))
    end

    test "detects unclosed single quote reaching tag end" do
      assert_parsed_snapshot(%(<div class='test>content</div>))
    end

    test "detects unclosed double quote reaching tag end" do
      assert_parsed_snapshot(%(<div class="test>content</div>))
    end

    test "handles unclosed quote with self-closing tag" do
      assert_parsed_snapshot(%(<img src="image.jpg />))
    end

    test "unclosed ERB tag at EOF" do
      assert_parsed_snapshot(%(<%= foo))
    end

    test "unclosed ERB comment at EOF" do
      assert_parsed_snapshot(%(<%# comment))
    end

    test "nested ERB tag inside ERB comment" do
      assert_parsed_snapshot(%(<%# Another comment with <%= "erb" %> inside %>))
    end

    test "multiple error types in single template" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <span class="unclosed
          <p>content</p>
        </span>
        </div>
      HTML
    end

    test "recovery with ERB content" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar %>
          <%= content %>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute value without closing quote" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar
          <%= content %>
        </div>
      HTML
    end

    test "closed ERB tag in attribute missing tag closing" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar %>"
          <%= content %>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute value with space before quote" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar ">
          <%= content %>
        </div>
      HTML
    end

    test "unclosed ERB tag in attribute value without space before quote" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar">
          <%= content %>
        </div>
      HTML
    end

    test "closed ERB tag in attribute with extra closing angle bracket" do
      assert_parsed_snapshot(<<~HTML)
        <div class="foo<%= bar %>>
          <%= content %>
        </div>
      HTML
    end

    test "nested unclosed tags with recovery" do
      assert_parsed_snapshot(<<~HTML)
        <div>
          <span class="test
          <em>emphasized</em>
        </div>
      HTML
    end
  end
end
