# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"
require_relative "../snapshot_utils"

module Engine
  class ErrorHandlingTest < Minitest::Spec
    include SnapshotUtils

    class ChattyVisitor < Herb::Visitor
      def initialize
        super
        @junk = "x" * 500
      end
    end

    describe "what a parse error remembers about the compile" do
      def broken
        "<div>\n  <form>\n</div>\n"
      end

      test "describes each visitor the way the visitor describes itself" do
        error = assert_raises(Herb::Engine::ParseError) do
          Herb::Engine.new(broken, filename: "a.html.erb", visitors: Herb::Engine::Validators.all)
        end

        assert_equal(
          [
            "#<Herb::Engine::Validators::SecurityValidator fatal=true>",
            "#<Herb::Engine::Validators::NestingValidator fatal=true>",
            "#<Herb::Engine::Validators::AccessibilityValidator fatal=true>"
          ],
          error.visitors
        )
      end

      test "caps a visitor that describes itself at length" do
        error = assert_raises(Herb::Engine::ParseError) do
          Herb::Engine.new(broken, filename: "a.html.erb", visitors: [ChattyVisitor.new])
        end

        described = error.visitors.first

        assert_equal Herb::Visitor::Stack::DESCRIPTION_LIMIT + 1, described.length
        assert described.end_with?("\u2026"), "expected the description to be cut short"
      end

      test "carries the parser options the parse actually ran under" do
        error = assert_raises(Herb::Engine::ParseError) do
          Herb::Engine.new(broken, filename: "a.html.erb", visitors: Herb::Engine::Validators.all)
        end

        assert_equal({ track_locations: true }, error.parser_options)
      end
    end

    test "mismatched html tags" do
      template = <<~ERB
        <div>
          <h1>Title</h1>
          <section>Some text
        </span>
      ERB

      assert_error_snapshot(template)
    end

    test "unclosed html element" do
      template = <<~ERB
        <section>
          <div class="content">
            <p>This div is never closed
          </div>
        <!-- Missing </section> -->
      ERB

      assert_error_snapshot(template)
    end

    test "missing opening tag" do
      template = <<~ERB
        <div>
          <p>Some content</p>
        </div>
        </span>
      ERB

      assert_error_snapshot(template)
    end

    test "void element with closing tag" do
      template = <<~ERB
        <div>
          <img src="photo.jpg"></img>
          <br></br>
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "missing erb end" do
      template = <<~ERB
        <div>
          <% if user.active? %>
            <span>Active</span>
          <!-- Missing end! -->
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "ruby syntax error" do
      template = <<~ERB
        <div>
          <%= user.name.upcase( %>
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "nested anchor tags" do
      template = <<~ERB
        <a href="/page1">
          Link to page 1
          <a href="/page2">Nested link</a>
        </a>
      ERB

      assert_error_snapshot(template)
    end

    test "block element in paragraph" do
      template = <<~ERB
        <p>
          This is a paragraph with a
          <div>block element inside</div>
          which is invalid HTML!
        </p>
      ERB

      assert_error_snapshot(template)
    end

    test "error with filename" do
      template = <<~ERB
        <div>
          <h1>Title</h1>
        </span>
      ERB

      assert_error_snapshot(template, validators: false, filename: "test_template.erb")
    end

    test "multiple errors reported" do
      template = <<~ERB
        <div>
          <p>Unclosed paragraph
          <img src="test.jpg"></img>
        </span>
      ERB

      assert_error_snapshot(template)
    end

    test "error with line numbers" do
      template = <<~ERB
        <div class="container">
          <h1>Title</h1>
          <p>Some text
        </span>
      ERB

      assert_error_snapshot(template)
    end

    test "error with source context" do
      template = <<~ERB
        <div>
          <h1>Working title</h1>
          <section>Text content
        </wrong_tag>
      ERB

      assert_error_snapshot(template)
    end

    test "unclosed quotes in attributes" do
      template = <<~ERB
        <div class="container unclosed>
          Content
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "invalid html structure" do
      template = <<~ERB
        <html>
          <head>
            <body>Invalid nesting</body>
          </head>
        </html>
      ERB

      begin
        engine = Herb::Engine.new(template)

        assert_instance_of Herb::Engine, engine
      rescue Herb::Engine::CompilationError => e
        assert_instance_of String, e.message
      end
    end

    test "deeply nested structure parsing" do
      template = <<~ERB
        <div>
          <% 10.times do |i| %>
            <% if i.even? %>
              <% 5.times do |j| %>
                <span><%= i * j %></span>
              <% end %>
            <% else %>
              <p>Odd: <%= i %></p>
            <% end %>
          <% end %>
        </div>
      ERB

      engine = Herb::Engine.new(template)

      assert_instance_of Herb::Engine, engine
      assert_instance_of String, engine.src
    end

    test "empty erb tags" do
      template = <<~ERB
        <div>
          <%= %>
          <% %>
        </div>
      ERB

      assert_instance_of Herb::Engine, Herb::Engine.new(template)
    end

    test "malformed erb tags" do
      template = <<~ERB
        <div>
          <% invalid erb syntax here! @#$%^&*
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "case sensitivity in tag names" do
      template = <<~ERB
        <DIV>
          <P>Content</p>
        </div>
      ERB

      begin
        engine = Herb::Engine.new(template)
        assert_instance_of Herb::Engine, engine
      rescue Herb::Engine::CompilationError => e
        assert_instance_of String, e.message
      end
    end

    test "special characters in content" do
      template = <<~ERB
        <div>
          Content with & < > " ' special chars
          <%= "More & special < characters > here" %>
        </div>
      ERB

      engine = Herb::Engine.new(template)

      assert_instance_of Herb::Engine, engine
      assert_instance_of String, engine.src
    end

    test "ruby comment at end of ERB content tag" do
      template = <<~ERB
        <% if true # some comment %> true <% else %> false <% end %>
      ERB

      assert_error_snapshot(template, validators: false)
    end

    test "tags spanning erb control flow boundaries are recognized as conditional elements" do
      template = <<~ERB
        <% if condition? %>
          <div>
        <% end %>

        <% if condition? %>
          </div>
        <% end %>
      ERB

      engine = Herb::Engine.new(template)
      assert_kind_of Herb::Engine, engine
    end

    test "invalid erb control flow structure - else outside scope" do
      template = <<~ERB
        <div
          <% if some_condition %>
            class="a"
        >
          <% else %>
          <% end %>
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "invalid erb control flow structure - end outside scope" do
      template = <<~ERB
        <div
          <% if some_condition %>
            class="a"
          <% else %>
            class="b"
        >
          <% end %>
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "invalid erb control flow structure - elsif outside scope" do
      template = <<~ERB
        <div
          <% if some_condition %>
        >
          <% elsif other_condition %>
          <% end %>
        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "invalid erb structure - else outside scope before tag closing" do
      template = <<~ERB
        <div
          <% if some_condition %>
            class="a"
          <% else %>
        >
        <% end %>

        </div>
      ERB

      assert_error_snapshot(template)
    end

    test "valid erb structure - if/else/end inside tag attributes" do
      template = <<~ERB
        <div
          <% if some_condition %>
            class="a"
          <% else %>
            class="b"
          <% end %>
        ></div>
      ERB

      engine = Herb::Engine.new(template)

      assert_instance_of Herb::Engine, engine
      assert_instance_of String, engine.src
    end

    describe "what the message says and what it holds back" do
      def broken
        <<~ERB
          <article class="post">
            <form action="/posts" method="post">
          </article>
        ERB
      end

      def error_for(template = broken, filename: "app/views/posts/index.html.erb")
        assert_raises(Herb::Engine::CompilationError) do
          Herb::Engine.new(template, filename: filename, visitors: Herb::Engine::Validators.all)
        end
      end

      test "keeps the message to a single line, so a log line stays a log line" do
        assert_equal 1, error_for.message.lines.length
      end

      test "names where the fault is, the way a compiler does" do
        assert_match(%r{\Aapp/views/posts/index\.html\.erb:\d+:\d+: }, error_for.message)
      end

      test "counts the errors it held back" do
        template = <<~ERB
          <div>
            <section>
          </wrong_tag>
        ERB

        assert_includes error_for(template).message, "more error"
      end

      test "puts the rendered source in the detailed message instead" do
        error = error_for

        refute_includes error.message, "\u2502"
        assert_includes error.detailed_message, "\u2502"
        assert_includes error.detailed_message, "~"
      end

      test "leaves the detailed message plain unless asked to highlight" do
        refute_includes error_for.detailed_message, "\e["
      end

      test "colors the detailed message when asked" do
        assert_includes error_for.detailed_message(highlight: true), "\e["
      end

      test "still says the whole message when there is nothing held back" do
        error = Herb::Engine::CompilationError.new("plain")

        assert_equal "plain", error.message
        assert_includes error.detailed_message, "plain"
      end
    end
  end
end
