# frozen_string_literal: true

require "date"

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class EvaluationTest < Minitest::Spec
    include SnapshotUtils

    User = Struct.new(:id, :name, :score, :active?, keyword_init: true)
    Post = Struct.new(:title, :author, :date, :excerpt, :tags, keyword_init: true)

    test "basic text output" do
      template = "<div>Hello World</div>"

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "variable interpolation" do
      template = "<div>Hello <%= name %>!</div>"

      assert_evaluated_snapshot(template, { name: "Alice" }, { escape: false })
    end

    test "html escaping enabled" do
      template = "<div><%= content %></div>"

      assert_evaluated_snapshot(
        template,
        { content: "<script>alert('xss')</script>" },
        { escape: true }
      )
    end

    test "html escaping disabled" do
      template = "<div><%= content %></div>"

      assert_evaluated_snapshot(
        template,
        { content: "<strong>Bold</strong>" },
        { escape: false }
      )
    end

    test "conditional rendering true" do
      template = <<~ERB
        <div>
          <% if show_message? %>
            <p>Message is shown</p>
          <% else %>
            <p>Message is hidden</p>
          <% end %>
        </div>
      ERB

      assert_evaluated_snapshot(template, { show_message?: true }, { escape: false })
    end

    test "conditional rendering false" do
      template = <<~ERB
        <div>
          <% if show_message? %>
            <p>Message is shown</p>
          <% else %>
            <p>Message is hidden</p>
          <% end %>
        </div>
      ERB

      assert_evaluated_snapshot(template, { show_message?: false }, { escape: false })
    end

    test "loop rendering" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <li><%= item %></li>
          <% end %>
        </ul>
      ERB

      assert_evaluated_snapshot(template, { items: ["apple", "banana", "cherry"] }, { escape: false })
    end

    test "nested loops" do
      template = <<~ERB
        <div>
          <% categories.each do |category| %>
            <h3><%= category[:name] %></h3>
            <ul>
              <% category[:items].each do |item| %>
                <li><%= item %></li>
              <% end %>
            </ul>
          <% end %>
        </div>
      ERB

      categories = [
        { name: "Fruits", items: ["apple", "banana"] },
        { name: "Colors", items: ["red", "blue"] }
      ]

      assert_evaluated_snapshot(template, { categories: categories }, { escape: false })
    end

    test "complex expressions" do
      template = <<~ERB
        <div class="user-<%= user.id %>" data-active="<%= user.active? %>">
          <h1><%= user.name.upcase %></h1>
          <p>Score: <%= user.score * 2 %></p>
          <% if user.score > 50 %>
            <span class="high-score">Excellent!</span>
          <% end %>
        </div>
      ERB

      user = User.new(
        id: 123,
        name: "John Doe",
        score: 75,
        active?: true
      )

      assert_evaluated_snapshot(template, { user: user }, { escape: false })
    end

    test "method calls with blocks" do
      template = <<~ERB
        <div>
          <%= [1, 2, 3].map { |n| n * 2 }.join(", ") %>
        </div>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "unless conditional false" do
      template = <<~ERB
        <% unless hide_content? %>
          <p>Content is visible</p>
        <% else %>
          <p>Content is hidden</p>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { hide_content?: false }, { escape: false })
    end

    test "unless conditional true" do
      template = <<~ERB
        <% unless hide_content? %>
          <p>Content is visible</p>
        <% else %>
          <p>Content is hidden</p>
        <% end %>
      ERB

      assert_evaluated_snapshot(template, { hide_content?: true }, { escape: false })
    end

    test "case statement pending" do
      template = <<~ERB
        <div>
          <% case status %>
          <% when "pending" %>
            <span class="yellow">Pending</span>
          <% when "approved" %>
            <span class="green">Approved</span>
          <% when "rejected" %>
            <span class="red">Rejected</span>
          <% else %>
            <span class="gray">Unknown</span>
          <% end %>
        </div>
      ERB

      assert_evaluated_snapshot(template, { status: "pending" }, { escape: false })
    end

    test "case statement approved" do
      template = <<~ERB
        <div>
          <% case status %>
          <% when "pending" %>
            <span class="yellow">Pending</span>
          <% when "approved" %>
            <span class="green">Approved</span>
          <% when "rejected" %>
            <span class="red">Rejected</span>
          <% else %>
            <span class="gray">Unknown</span>
          <% end %>
        </div>
      ERB

      assert_evaluated_snapshot(template, { status: "approved" }, { escape: false })
    end

    test "case statement unknown" do
      template = <<~ERB
        <div>
          <% case status %>
          <% when "pending" %>
            <span class="yellow">Pending</span>
          <% when "approved" %>
            <span class="green">Approved</span>
          <% when "rejected" %>
            <span class="red">Rejected</span>
          <% else %>
            <span class="gray">Unknown</span>
          <% end %>
        </div>
      ERB

      assert_evaluated_snapshot(template, { status: "invalid" }, { escape: false })
    end

    test "erb in attribute values" do
      template = <<~ERB
        <a href="<%= link_url %>" class="btn <%= css_classes.join(' ') %>" data-count="<%= items.length %>">
          <%= link_text %>
        </a>
      ERB

      assert_evaluated_snapshot(template, {
        link_url: "/users/123",
        css_classes: ["primary", "large"],
        items: [1, 2, 3, 4, 5],
        link_text: "View Profile",
      }, { escape: false })
    end

    test "whitespace handling" do
      template = <<~ERB
        <div>
          <% items.each do |item| -%>
          <span><%= item %></span>
          <% end -%>
        </div>
      ERB

      assert_evaluated_snapshot(template, { items: ["a", "b"] }, { escape: false })
    end

    test "erb comments not in output" do
      template = <<~ERB
        <div>
          <%# This is a comment %>
          <p>Visible content</p>
          <%# Another comment with <%= "erb" %> inside %>
          <p>More content</p>
        </div>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "html comments in output" do
      template = <<~ERB
        <div>
          <!-- HTML comment -->
          <p>Content</p>
          <!-- Comment with <%= "ERB" %> -->
        </div>
      ERB

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "empty template" do
      template = ""

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "only whitespace template" do
      template = "   \n  \t  \n   "

      assert_evaluated_snapshot(template, {}, { escape: false })
    end

    test "complex real world example" do
      template = <<~ERB
        <!DOCTYPE html>
        <html>
          <head>
            <title><%= page_title %></title>
            <meta name="description" content="<%= meta_description %>">
          </head>
          <body class="<%= body_classes.join(' ') %>">
            <header>
              <h1><%= site_name %></h1>
              <nav>
                <% navigation_items.each do |item| %>
                  <a href="<%= item[:url] %>" class="<%= item[:active] ? 'active' : '' %>">
                    <%= item[:title] %>
                  </a>
                <% end %>
              </nav>
            </header>
        #{"    "}
            <main>
              <% if flash_message %>
                <div class="alert alert-<%= flash_type %>">
                  <%= flash_message %>
                </div>
              <% end %>
        #{"      "}
              <section class="content">
                <% unless posts.empty? %>
                  <% posts.each_with_index do |post, index| %>
                    <article class="post" data-index="<%= index %>">
                      <h2><%= post.title %></h2>
                      <p class="meta">
                        By <%= post.author %> on <%= post.date.strftime("%B %d, %Y") %>
                      </p>
                      <div class="content">
                        <%= post.excerpt %>
                      </div>
                      <% if post.tags.any? %>
                        <div class="tags">
                          <% post.tags.each do |tag| %>
                            <span class="tag"><%= tag %></span>
                          <% end %>
                        </div>
                      <% end %>
                    </article>
                  <% end %>
                <% else %>
                  <p class="no-posts">No posts available.</p>
                <% end %>
              </section>
            </main>
        #{"    "}
            <footer>
              <p>&copy; <%= Date.today.year %> <%= site_name %></p>
            </footer>
          </body>
        </html>
      ERB

      posts = [
        Post.new(
          title: "First Post",
          author: "John Doe",
          date: Date.new(2024, 1, 15),
          excerpt: "This is the first post excerpt.",
          tags: ["ruby", "programming"]
        ),
        Post.new(
          title: "Second Post",
          author: "Jane Smith",
          date: Date.new(2024, 2, 1),
          excerpt: "This is the second post excerpt.",
          tags: ["html", "css"]
        )
      ]

      navigation_items = [
        { title: "Home", url: "/", active: true },
        { title: "About", url: "/about", active: false },
        { title: "Contact", url: "/contact", active: false }
      ]

      assert_evaluated_snapshot(template, {
        page_title: "My Blog",
        meta_description: "A blog about programming",
        body_classes: ["blog", "home"],
        site_name: "My Awesome Blog",
        navigation_items: navigation_items,
        flash_message: "Welcome!",
        flash_type: "success",
        posts: posts,
      }, { escape: false })
    end
  end
end
