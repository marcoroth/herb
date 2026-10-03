# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/dev/classifier"

module Dev
  class ClassifierTest < Minitest::Spec
    def classify(previous, current, configuration: nil)
      Herb::Dev::Classifier.new(configuration: configuration).call(previous, current)
    end

    test "an unchanged template is :none" do
      source = "<div>\n  <p>Hi</p>\n</div>\n"

      assert_equal :none, classify(source, source).kind
    end

    test "a reindent is :whitespace, not :dynamic" do
      classification = classify("<div>\n  <p>Hi</p>\n</div>\n", "<div>\n    <p>Hi</p>\n</div>\n")

      assert_equal :whitespace, classification.kind
      assert_equal [:whitespace_changed], classification.operations.map(&:type)
    end

    test "collapsing an internal run of spaces is :whitespace" do
      assert_equal :whitespace, classify("<p>Hi  there</p>", "<p>Hi there</p>").kind
    end

    test "a text edit is :static" do
      classification = classify("<div><p>Hi</p></div>", "<div><p>Hello</p></div>")

      assert_equal :static, classification.kind
    end

    test "an attribute edit is :static" do
      assert_equal :static, classify('<div class="old"></div>', '<div class="new"></div>').kind
    end

    test "a reindent around a text edit is :static, judged on the text edit alone" do
      classification = classify("<div>\n  <p>Hi</p>\n</div>\n", "<div>\n    <p>Hello</p>\n</div>\n")

      assert_equal :static, classification.kind
    end

    test "an inserted element is :dynamic" do
      assert_equal :dynamic, classify("<div></div>", "<div><span>New</span></div>").kind
    end

    test "an ERB content edit is :dynamic" do
      assert_equal :dynamic, classify("<p><%= name %></p>", "<p><%= name.upcase %></p>").kind
    end

    test "a broken template is :parse_error and carries the errors" do
      classification = classify("<div></div>", "<div>\n  <form>\n</div>\n")

      assert_equal :parse_error, classification.kind
      refute_empty classification.errors
    end

    test "node_path covers a single operation's path" do
      classification = classify("<div><p>Hi</p></div>", "<div><p>Hello</p></div>")

      assert_equal classification.operations.first.path, classification.node_path
    end

    test "node_path is the common prefix when two operations diverge" do
      classification = classify(
        "<section><p>one</p><p>two</p></section>",
        "<section><p>eins</p><p>zwei</p></section>"
      )

      operations = classification.operations
      prefix = classification.node_path

      operations.each do |operation|
        assert_equal prefix, operation.path.first(prefix.length)
      end

      refute_equal operations.first.path, operations.last.path
    end

    test "whitespace operations do not widen the node_path" do
      classification = classify(
        "<div>\n  <p>Hi</p>\n</div>\n",
        "<div>\n\n    <p>Hello</p>\n</div>\n"
      )

      assert_equal :static, classification.kind

      significant = classification.operations.reject { |operation| operation.type == :whitespace_changed }

      assert_equal significant.first.path, classification.node_path
    end

    test "configured ERB openers cap the kind at :dynamic" do
      configuration = Struct.new(:parser_options).new({ erb_openers: ["<%%"] })

      classification = classify("<div><p>Hi</p></div>", "<div><p>Hello</p></div>", configuration: configuration)

      assert_equal :dynamic, classification.kind
    end
  end
end
