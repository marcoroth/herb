# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class ConditionalElementTest < Minitest::Spec
    include SnapshotUtils

    test "simple conditional element with condition true" do
      template = <<~ERB
        <% if @with_wrapper %>
          <div class="wrapper">
        <% end %>
          <span>Content</span>
        <% if @with_wrapper %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@with_wrapper => true }, { escape: false })
    end

    test "simple conditional element with condition false" do
      template = <<~ERB
        <% if @with_wrapper %>
          <div class="wrapper">
        <% end %>
          <span>Content</span>
        <% if @with_wrapper %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@with_wrapper => false }, { escape: false })
    end

    test "conditional element with unless condition true" do
      template = <<~ERB
        <% unless @compact %>
          <div class="expanded">
        <% end %>
          <span>Content</span>
        <% unless @compact %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@compact => true }, { escape: false })
    end

    test "conditional element with unless condition false" do
      template = <<~ERB
        <% unless @compact %>
          <div class="expanded">
        <% end %>
          <span>Content</span>
        <% unless @compact %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@compact => false }, { escape: false })
    end

    test "nested conditional elements both conditions true" do
      template = <<~ERB
        <% if @outer %>
          <div class="outer">
        <% end %>
          <% if @inner %>
            <section class="inner">
          <% end %>
            <span>Nested content</span>
          <% if @inner %>
            </section>
          <% end %>
        <% if @outer %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@outer => true, :@inner => true }, { escape: false })
    end

    test "nested conditional elements outer true inner false" do
      template = <<~ERB
        <% if @outer %>
          <div class="outer">
        <% end %>
          <% if @inner %>
            <section class="inner">
          <% end %>
            <span>Nested content</span>
          <% if @inner %>
            </section>
          <% end %>
        <% if @outer %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@outer => true, :@inner => false }, { escape: false })
    end

    test "nested conditional elements outer false inner true" do
      template = <<~ERB
        <% if @outer %>
          <div class="outer">
        <% end %>
          <% if @inner %>
            <section class="inner">
          <% end %>
            <span>Nested content</span>
          <% if @inner %>
            </section>
          <% end %>
        <% if @outer %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@outer => false, :@inner => true }, { escape: false })
    end

    test "nested conditional elements both conditions false" do
      template = <<~ERB
        <% if @outer %>
          <div class="outer">
        <% end %>
          <% if @inner %>
            <section class="inner">
          <% end %>
            <span>Nested content</span>
          <% if @inner %>
            </section>
          <% end %>
        <% if @outer %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@outer => false, :@inner => false }, { escape: false })
    end

    test "conditional element with attributes condition true" do
      template = <<~ERB
        <% if @styled %>
          <div id="container" class="styled" data-value="test">
        <% end %>
          <span>Styled content</span>
        <% if @styled %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@styled => true }, { escape: false })
    end

    test "conditional element with attributes condition false" do
      template = <<~ERB
        <% if @styled %>
          <div id="container" class="styled" data-value="test">
        <% end %>
          <span>Styled content</span>
        <% if @styled %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@styled => false }, { escape: false })
    end

    test "conditional element inside loop" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <% if item[:wrapped] %>
              <li class="wrapped">
            <% end %>
              <span><%= item[:name] %></span>
            <% if item[:wrapped] %>
              </li>
            <% end %>
          <% end %>
        </ul>
      ERB

      items = [
        { name: "First", wrapped: true },
        { name: "Second", wrapped: false },
        { name: "Third", wrapped: true }
      ]

      assert_evaluated_snapshot(template, { items: items }, { escape: false })
    end

    test "multiple sequential conditional elements" do
      template = <<~ERB
        <% if @show_header %>
          <header>
        <% end %>
          <h1>Title</h1>
        <% if @show_header %>
          </header>
        <% end %>

        <% if @show_footer %>
          <footer>
        <% end %>
          <p>Footer content</p>
        <% if @show_footer %>
          </footer>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { :@show_header => true, :@show_footer => false }, { escape: false })
    end

    test "conditional element with erb content inside" do
      template = <<~ERB
        <% if @with_card %>
          <div class="card">
        <% end %>
          <h2><%= title %></h2>
          <p><%= description %></p>
        <% if @with_card %>
          </div>
        <% end %>
      ERB

      assert_evaluated_snapshot(
        template,
        { :@with_card => true, title: "Card Title", description: "Card description text" },
        { escape: false }
      )
    end

    test "conditional element compilation" do
      template = <<~ERB
        <% if @with_icon %>
          <div class="icon">
        <% end %>
          <span>Hello</span>
        <% if @with_icon %>
          </div>
        <% end %>
      ERB

      assert_compiled_snapshot(template, escape: false)
    end

    test "nested conditional element compilation" do
      template = <<~ERB
        <% if @outer %>
          <div class="outer">
        <% end %>
          <% if @inner %>
            <section>
          <% end %>
            <span>Content</span>
          <% if @inner %>
            </section>
          <% end %>
        <% if @outer %>
          </div>
        <% end %>
      ERB

      assert_compiled_snapshot(template, escape: false)
    end

    test "example file conditional element with condition true" do
      template = File.read(File.expand_path("../../examples/conditional_html_element.html.erb", __dir__))

      assert_evaluated_snapshot(template, { :@with_icon => true }, { escape: false })
    end

    test "example file conditional element with condition false" do
      template = File.read(File.expand_path("../../examples/conditional_html_element.html.erb", __dir__))

      assert_evaluated_snapshot(template, { :@with_icon => false }, { escape: false })
    end

    test "example file conditional element compilation" do
      template = File.read(File.expand_path("../../examples/conditional_html_element.html.erb", __dir__))

      assert_compiled_snapshot(template, escape: false)
    end

    test "compilation fails with multiple nested tags in single conditional" do
      template = <<~ERB
        <% if @wrapped %>
          <div class="outer">
            <div class="inner">
        <% end %>
          <span>Body</span>
        <% if @wrapped %>
            </div>
          </div>
        <% end %>
      ERB

      assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end
    end

    test "compilation fails when if vs unless mismatch" do
      template = <<~ERB
        <% if @condition %>
          <div>
        <% end %>
          <span>Content</span>
        <% unless @condition %>
          </div>
        <% end %>
      ERB

      assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end
    end

    test "compilation fails when conditions differ" do
      template = <<~ERB
        <% if @open_condition %>
          <div>
        <% end %>
          <span>Content</span>
        <% if @close_condition %>
          </div>
        <% end %>
      ERB

      assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end
    end

    test "compilation fails when conditional has else branch" do
      template = <<~ERB
        <% if @condition %>
          <div>
        <% else %>
          <section>
        <% end %>
          <span>Content</span>
        <% if @condition %>
          </div>
        <% end %>
      ERB

      assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end
    end

    test "compilation fails when tag names differ" do
      template = <<~ERB
        <% if @condition %>
          <div>
        <% end %>
          <span>Content</span>
        <% if @condition %>
          </section>
        <% end %>
      ERB

      assert_raises(Herb::Engine::CompilationError) do
        Herb::Engine.new(template)
      end
    end
  end
end
