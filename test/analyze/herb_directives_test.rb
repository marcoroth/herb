# frozen_string_literal: true

require_relative "../test_helper"

module Analyze
  class HerbDirectivesTest < Minitest::Spec
    include SnapshotUtils

    test "state directive with a single boolean state" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (open: false) %>
      HTML
    end

    test "state directive with several states" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (open: false, count: 0, title: "") %>
      HTML
    end

    test "state directive covering every default kind" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (a: true, b: 0, c: 1.5, d: "s", e: :sym, f: nil, g: [], h: {}, i: bare, j: Time.now) %>
      HTML
    end

    test "state directive with an exponent default is a Float to Prism" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (timeout: 1e3) %>
      HTML
    end

    test "state directive indented inside an iteration block" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <% items.each do |item| %>
          <%# herb:state (open: false) %>
        <% end %>
      HTML
    end

    test "state directive without the option enabled stays an ERBContentNode" do
      assert_parsed_snapshot(<<~HTML)
        <%# herb:state (open: false) %>
      HTML
    end

    test "state directive spelled with trim markers" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%#- herb:state (open: false) -%>
      HTML
    end

    test "state directive without a space after the ERB comment opening" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%#herb:state (open: false) %>
      HTML
    end

    test "state directive with extra whitespace before the signature" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state  (open: false) %>
      HTML
    end

    test "state directive without a space before the ERB comment closing" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (open: false)%>
      HTML
    end

    test "state directive spread across several lines" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (
          open: false,
          count: 0
        ) %>
      HTML
    end

    test "state directive without parentheses" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state open: false %>
      HTML
    end

    test "state directive with an empty payload" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state %>
      HTML
    end

    test "state directive with an empty signature" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state () %>
      HTML
    end

    test "state directive declaring a positional argument" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (open) %>
      HTML
    end

    test "state directive declaring a keyword without a default" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (open:) %>
      HTML
    end

    test "state directive declaring a splat argument" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (*rest) %>
      HTML
    end

    test "state directive declaring a block argument" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (&block) %>
      HTML
    end

    test "state directive declaring the same state name twice" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (open: false, count: 0, open: true) %>
      HTML
    end

    test "state directive with a signature that does not parse" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (1 +) %>
      HTML
    end

    test "two state directives in the same scope" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (a: 1) %>
        <%# herb:state (b: 2) %>
      HTML
    end

    test "state directives in separate scopes" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:state (a: 1) %>
        <% items.each do |item| %>
          <%# herb:state (b: 2) %>
        <% end %>
      HTML
    end

    test "disable directive with a rule name" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable erb-comment-syntax %>
      HTML
    end

    test "disable directive with several rule names" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable erb-comment-syntax, html-tag-name-lowercase %>
      HTML
    end

    test "disable directive with several rule names and no space after the comma" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable erb-comment-syntax,html-tag-name-lowercase %>
      HTML
    end

    test "disable directive disabling all rules" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable all %>
      HTML
    end

    test "disable directive naming all alongside a rule" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable all, erb-comment-syntax %>
      HTML
    end

    test "disable directive naming the same rule twice" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable erb-comment-syntax, erb-comment-syntax %>
      HTML
    end

    test "disable directive without rule names" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable %>
      HTML
    end

    test "disable directive without a space after the directive word" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disableall %>
      HTML
    end

    test "disable directive with a dash after the directive word" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable-all %>
      HTML
    end

    test "disable directive with a trailing comma" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable erb-comment-syntax, %>
      HTML
    end

    test "disable directive with a leading comma" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable ,erb-comment-syntax %>
      HTML
    end

    test "disable directive with consecutive commas" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:disable erb-comment-syntax,,html-tag-name-lowercase %>
      HTML
    end

    test "disable directive anchored to the element above it" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <DIV>text</DIV>
        <%# herb:disable html-tag-name-lowercase %>
      HTML
    end

    test "disable directive at the end of a line of markup" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <DIV>text</DIV> <%# herb:disable html-tag-name-lowercase %>
      HTML
    end

    test "disable directive written with a Ruby comment instead of an ERB comment" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <% # herb:disable html-tag-name-lowercase %>
      HTML
    end

    test "disable directive written with a trim marker Ruby comment" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%-# herb:disable html-tag-name-lowercase %>
      HTML
    end

    test "slots directive without a mode" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:slots %>
      HTML
    end

    test "slots directive in client mode" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:slots client %>
      HTML
    end

    test "slots directive in server mode" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:slots server %>
      HTML
    end

    test "slots directive naming both modes" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:slots client server %>
      HTML
    end

    test "slots directive naming something that is not a mode" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:slots sometimes %>
      HTML
    end

    test "formatter ignore directive" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:formatter ignore %>
      HTML
    end

    test "formatter directive without a payload" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:formatter %>
      HTML
    end

    test "formatter ignore directive with an extra word" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:formatter ignore everything %>
      HTML
    end

    test "formatter ignore directive wrapping markup" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:formatter ignore %>
        <div   class="a"  >text</div>
      HTML
    end

    test "linter ignore directive" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:linter ignore %>
      HTML
    end

    test "linter directive without a payload" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:linter %>
      HTML
    end

    test "key directive" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:key item.id %>
      HTML
    end

    test "key directive without a payload" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:key %>
      HTML
    end

    test "key directive inside an iteration block" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <% items.each do |item| %>
          <%# herb:key item.id %>
        <% end %>
      HTML
    end

    test "several directive families in one document" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:slots client %>
        <%# herb:state (open: false) %>
        <%# herb:disable html-tag-name-lowercase %>
        <%# herb:formatter ignore %>
      HTML
    end

    test "unknown directive" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:blahblah %>
      HTML
    end

    test "unknown directive with arguments" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb:blahblah some payload %>
      HTML
    end

    test "ERB comment that is not a directive" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# just an ordinary comment %>
      HTML
    end

    test "ERB comment mentioning herb without a directive word" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# herb: %>
      HTML
    end

    test "strict locals declaration is not a Herb directive" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true)
        <%# locals: (message:) %>
      HTML
    end

    test "strict locals and a state directive in the same document" do
      assert_parsed_snapshot(<<~HTML, herb_directives: true, strict_locals: true)
        <%# locals: (message:) %>
        <%# herb:state (open: false) %>
      HTML
    end
  end
end
