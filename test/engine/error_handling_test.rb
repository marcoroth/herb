# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class ErrorHandlingTest < Minitest::Spec
    test "mismatched html tags" do
      template = <<~ERB
        <div>
          <h1>Title</h1>
          <p>Some text
        </span>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "HTML+ERB Compilation Errors"
      assert_includes error.message, "TagNamesMismatch"
      assert_includes error.message, "Opening tag `<p>`"
      assert_includes error.message, "closed with `</span>`"
    end

    test "unclosed html element" do
      template = <<~ERB
        <section>
          <div class="content">
            <p>This div is never closed
          </div>
        <!-- Missing </section> -->
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "UnclosedElement"
      assert_includes error.message, "never closed before the end of document"
    end

    test "missing opening tag" do
      template = <<~ERB
        <div>
          <p>Some content</p>
        </div>
        </span>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "MissingOpeningTag"
      assert_includes error.message, "without a matching opening tag"
    end

    test "void element with closing tag" do
      template = <<~ERB
        <div>
          <img src="photo.jpg"></img>
          <br></br>
        </div>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "VoidElementClosingTag"
      assert_includes error.message, "void element"
    end

    test "missing erb end" do
      template = <<~ERB
        <div>
          <% if user.active? %>
            <span>Active</span>
          <!-- Missing end! -->
        </div>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "Compilation Errors"
      assert_instance_of String, error.message
    end

    test "ruby syntax error" do
      template = <<~ERB
        <div>
          <%= user.name.upcase( %>
        </div>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "Compilation Errors"
      assert_instance_of String, error.message
    end

    test "nested anchor tags" do
      template = <<~ERB
        <a href="/page1">
          Link to page 1
          <a href="/page2">Nested link</a>
        </a>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_instance_of String, error.message
    end

    test "block element in paragraph" do
      template = <<~ERB
        <p>
          This is a paragraph with a
          <div>block element inside</div>
          which is invalid HTML!
        </p>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_instance_of String, error.message
    end

    test "error with filename" do
      template = <<~ERB
        <div>
          <h1>Title</h1>
        </span>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template, filename: "test_template.erb")
      end

      assert_includes error.message, "TagNamesMismatch: Opening tag `<div>` at (1:1) closed with `</span>` at (3:2)."
    end

    test "multiple errors reported" do
      template = <<~ERB
        <div>
          <p>Unclosed paragraph
          <img src="test.jpg"></img>
        </span>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "Total errors:"
      assert_instance_of String, error.message
      assert error.message.length > 100
    end

    test "error with line numbers" do
      template = <<~ERB
        <div class="container">
          <h1>Title</h1>
          <p>Some text
        </span>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, ":"
      assert error.message.match?(/\d+:\d+/)
    end

    test "error with source context" do
      skip "Skipping in CI due to formatting differences" if ENV["CI"]

      template = <<~ERB
        <div>
          <h1>Working title</h1>
          <p>Text content
        </wrong_tag>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_includes error.message, "Working"
      assert_includes error.message, "wrong_tag"
      assert_includes error.message, "→"
    end

    test "unclosed quotes in attributes" do
      template = <<~ERB
        <div class="container unclosed>
          Content
        </div>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_instance_of String, error.message
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

      begin
        engine = Herb::Engine.new(template)
        assert_instance_of Herb::Engine, engine
      rescue Herb::Engine::CompilationError => e
        assert_includes e.message, "Empty"
      end
    end

    test "malformed erb tags" do
      template = <<~ERB
        <div>
          <% invalid erb syntax here! @#$%^&*
        </div>
      ERB

      error = assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end

      assert_instance_of String, error.message
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
  end
end
