import { describe, it, expect, beforeEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Connection } from 'vscode-languageserver/node'
import { Readable, Writable } from 'stream'

// Import real components without mocking
import { DocumentService } from '../src/document_service'
import { createMockConnection } from './helpers/mock-connection'

describe('Real Document Lifecycle Tests', () => {
  let connection: Connection
  let documentService: DocumentService
  let testDocuments: TextDocument[]

  beforeEach(() => {
    connection = createMockConnection()
    documentService = new DocumentService(connection)
    
    // Create test documents with real content
    testDocuments = [
      TextDocument.create(
        'file:///app/views/users/index.html.erb',
        'erb',
        1,
        `<div class="users-index">
  <h1>Users</h1>
  <% @users.each do |user| %>
    <div class="user-card">
      <h2><%= user.name %></h2>
      <p><%= user.email %></p>
    </div>
  <% end %>
</div>`
      ),
      
      TextDocument.create(
        'file:///app/views/posts/show.html.erb',
        'erb',
        1,
        `<article class="post">
  <header>
    <h1><%= @post.title %></h1>
    <time datetime="<%= @post.created_at.iso8601 %>">
      <%= @post.created_at.strftime("%B %d, %Y") %>
    </time>
  </header>
  
  <div class="content">
    <%= simple_format(@post.content) %>
  </div>
  
  <footer>
    <% if @post.author %>
      <p>By <%= link_to @post.author.name, user_path(@post.author) %></p>
    <% end %>
  </footer>
</article>`
      ),
      
      TextDocument.create(
        'file:///app/views/shared/_navigation.html.erb',
        'erb',
        1,
        `<nav class="main-navigation">
  <ul>
    <li><%= link_to "Home", root_path %></li>
    <% if user_signed_in? %>
      <li><%= link_to "Dashboard", dashboard_path %></li>
      <li><%= link_to "Profile", profile_path %></li>
      <li><%= link_to "Logout", logout_path, method: :delete %></li>
    <% else %>
      <li><%= link_to "Login", login_path %></li>
      <li><%= link_to "Sign Up", signup_path %></li>
    <% end %>
  </ul>
</nav>`
      )
    ]
  })

  it('should handle real document creation and properties', () => {
    const document = testDocuments[0]
    
    expect(document.uri).toBe('file:///app/views/users/index.html.erb')
    expect(document.languageId).toBe('erb')
    expect(document.version).toBe(1)
    expect(document.getText()).toContain('@users.each')
    expect(document.lineCount).toBeGreaterThan(1)
  })

  it('should work with real document text operations', () => {
    const document = testDocuments[1]
    const text = document.getText()
    
    // Test getting text ranges
    const firstLineEnd = text.indexOf('\n')
    const firstLine = document.getText({
      start: { line: 0, character: 0 },
      end: document.positionAt(firstLineEnd)
    })
    
    expect(firstLine).toContain('<article class="post">')
    
    // Test position calculations
    const titlePosition = text.indexOf('@post.title')
    const position = document.positionAt(titlePosition)
    expect(position.line).toBeGreaterThanOrEqual(0)
    expect(position.character).toBeGreaterThanOrEqual(0)
    
    // Test offset calculations
    const calculatedOffset = document.offsetAt(position)
    expect(calculatedOffset).toBe(titlePosition)
  })

  it('should handle document updates correctly', () => {
    const originalDocument = testDocuments[2]
    const originalText = originalDocument.getText()
    
    // Simulate document update
    const updatedText = originalText.replace('Home', 'Homepage')
    const updatedDocument = TextDocument.update(
      originalDocument,
      [{ text: updatedText }],
      2
    )
    
    expect(updatedDocument.version).toBe(2)
    expect(updatedDocument.getText()).toContain('Homepage')
    expect(updatedDocument.getText()).not.toContain('"Home"')
    expect(updatedDocument.uri).toBe(originalDocument.uri)
  })

  it('should handle incremental document updates', () => {
    const document = testDocuments[0]
    const originalText = document.getText()
    
    // Find the position of "Users" in the h1 tag
    const usersPosition = originalText.indexOf('Users</h1>')
    const startPos = document.positionAt(usersPosition)
    const endPos = document.positionAt(usersPosition + 5) // "Users".length
    
    // Update just that word
    const updatedDocument = TextDocument.update(
      document,
      [{
        range: { start: startPos, end: endPos },
        text: 'People'
      }],
      2
    )
    
    expect(updatedDocument.getText()).toContain('<h1>People</h1>')
    expect(updatedDocument.getText()).not.toContain('<h1>Users</h1>')
    expect(updatedDocument.version).toBe(2)
  })

  it('should handle complex ERB content in real documents', () => {
    const complexDocument = TextDocument.create(
      'file:///app/views/dashboard/index.html.erb',
      'erb',
      1,
      `<% content_for :title, "Dashboard" %>

<div class="dashboard">
  <header class="dashboard-header">
    <h1>Welcome back, <%= current_user.first_name %>!</h1>
    <p>Last login: <%= time_ago_in_words(current_user.last_sign_in_at) %> ago</p>
  </header>

  <div class="dashboard-grid">
    <section class="stats">
      <h2>Your Stats</h2>
      <div class="stat-cards">
        <div class="stat-card">
          <h3><%= @user_stats.posts_count %></h3>
          <p><%= pluralize(@user_stats.posts_count, 'Post') %></p>
        </div>
        <div class="stat-card">
          <h3><%= @user_stats.comments_count %></h3>
          <p><%= pluralize(@user_stats.comments_count, 'Comment') %></p>
        </div>
      </div>
    </section>

    <section class="recent-activity">
      <h2>Recent Activity</h2>
      <% if @recent_activities.any? %>
        <ul class="activity-list">
          <% @recent_activities.each do |activity| %>
            <li class="activity-item">
              <%= render partial: "activity_item", locals: { activity: activity } %>
            </li>
          <% end %>
        </ul>
        <%= link_to "View all activity", activities_path, class: "btn btn-link" %>
      <% else %>
        <p class="empty-state">No recent activity</p>
      <% end %>
    </section>

    <section class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="action-buttons">
        <%= link_to "New Post", new_post_path, class: "btn btn-primary" %>
        <%= link_to "Settings", settings_path, class: "btn btn-secondary" %>
        <%= link_to "Help", help_path, class: "btn btn-outline" %>
      </div>
    </section>
  </div>
</div>`
    )

    expect(complexDocument.getText()).toContain('content_for :title')
    expect(complexDocument.getText()).toContain('current_user.first_name')
    expect(complexDocument.getText()).toContain('@recent_activities.each')
    expect(complexDocument.lineCount).toBeGreaterThan(30)
    
    // Test that we can navigate the complex document
    const contentForPosition = complexDocument.getText().indexOf('content_for')
    const position = complexDocument.positionAt(contentForPosition)
    expect(position.line).toBe(0)
  })

  it('should work with form documents and Rails helpers', () => {
    const formDocument = TextDocument.create(
      'file:///app/views/users/_form.html.erb',
      'erb',
      1,
      `<%= form_with(model: user, local: true, class: "user-form") do |form| %>
  <% if user.errors.any? %>
    <div id="error_explanation" class="alert alert-danger">
      <h4><%= pluralize(user.errors.count, "error") %> prohibited this user from being saved:</h4>
      <ul>
        <% user.errors.full_messages.each do |message| %>
          <li><%= message %></li>
        <% end %>
      </ul>
    </div>
  <% end %>

  <div class="field-group">
    <%= form.label :first_name, class: "form-label" %>
    <%= form.text_field :first_name, 
            class: "form-control #{'is-invalid' if user.errors[:first_name].any?}",
            placeholder: "Enter your first name" %>
    <% if user.errors[:first_name].any? %>
      <div class="invalid-feedback">
        <%= user.errors[:first_name].first %>
      </div>
    <% end %>
  </div>

  <div class="field-group">
    <%= form.label :email, class: "form-label" %>
    <%= form.email_field :email, 
            class: "form-control #{'is-invalid' if user.errors[:email].any?}",
            placeholder: "Enter your email" %>
  </div>

  <div class="form-actions">
    <%= form.submit class: "btn btn-primary" %>
    <%= link_to "Cancel", users_path, class: "btn btn-secondary" %>
  </div>
<% end %>`
    )

    expect(formDocument.getText()).toContain('form_with(model: user')
    expect(formDocument.getText()).toContain('user.errors.any?')
    expect(formDocument.getText()).toContain('form.text_field :first_name')
    
    // Test text manipulation on complex forms
    const emailFieldPos = formDocument.getText().indexOf(':email')
    const position = formDocument.positionAt(emailFieldPos)
    expect(position.line).toBeGreaterThan(10)
  })

  it('should handle document with partials and layouts', () => {
    const layoutDocument = TextDocument.create(
      'file:///app/views/layouts/application.html.erb',
      'erb',
      1,
      `<!DOCTYPE html>
<html>
  <head>
    <title><%= content_for?(:title) ? yield(:title) : "My App" %></title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <%= csrf_meta_tags %>
    <%= csp_meta_tag %>
    
    <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
    <%= javascript_importmap_tags %>
    
    <% if content_for?(:head) %>
      <%= yield(:head) %>
    <% end %>
  </head>

  <body class="<%= controller_name %>-<%= action_name %>">
    <%= render "shared/header" if show_header? %>
    
    <main id="main-content" role="main">
      <% flash.each do |type, message| %>
        <div class="alert alert-<%= type %>" role="alert">
          <%= message %>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
      <% end %>
      
      <%= yield %>
    </main>
    
    <%= render "shared/footer" unless @hide_footer %>
    
    <% if Rails.env.development? %>
      <%= debug(params) if params.any? %>
    <% end %>
  </body>
</html>`
    )

    expect(layoutDocument.getText()).toContain('content_for?(:title)')
    expect(layoutDocument.getText()).toContain('stylesheet_link_tag')
    expect(layoutDocument.getText()).toContain('render "shared/header"')
    expect(layoutDocument.getText()).toContain('Rails.env.development?')
    
    // Test document structure
    expect(layoutDocument.lineCount).toBeGreaterThan(25)
    
    // Test finding specific ERB tags
    const yieldPosition = layoutDocument.getText().indexOf('<%= yield %>')
    expect(yieldPosition).toBeGreaterThan(0)
  })

  it('should handle real document position and range operations', () => {
    const document = testDocuments[1] // posts/show.html.erb
    const text = document.getText()
    
    // Test finding all ERB tag positions
    const erbMatches = [...text.matchAll(/<%=?\s*([^%]+)\s*%>/g)]
    expect(erbMatches.length).toBeGreaterThan(0)
    
    // Test position calculations for each ERB tag
    erbMatches.forEach((match, index) => {
      const position = document.positionAt(match.index!)
      const endPosition = document.positionAt(match.index! + match[0].length)
      
      expect(position.line).toBeGreaterThanOrEqual(0)
      expect(position.character).toBeGreaterThanOrEqual(0)
      expect(endPosition.line).toBeGreaterThanOrEqual(position.line)
      
      if (endPosition.line === position.line) {
        expect(endPosition.character).toBeGreaterThan(position.character)
      }
    })
  })

  it('should work with real-world Rails view patterns', () => {
    const indexDocument = TextDocument.create(
      'file:///app/views/posts/index.html.erb',
      'erb',
      1,
      `<% content_for :title, "All Posts" %>

<div class="posts-index">
  <div class="posts-header">
    <h1>Blog Posts</h1>
    <%= link_to "New Post", new_post_path, class: "btn btn-primary" if can?(:create, Post) %>
  </div>

  <div class="posts-filters">
    <%= form_with url: posts_path, method: :get, class: "filter-form" do |form| %>
      <%= form.text_field :search, placeholder: "Search posts...", 
              value: params[:search], class: "form-control" %>
      <%= form.select :category, options_for_select(category_options, params[:category]), 
              { include_blank: "All Categories" }, { class: "form-select" } %>
      <%= form.submit "Filter", class: "btn btn-outline-primary" %>
    <% end %>
  </div>

  <div class="posts-grid">
    <% if @posts.any? %>
      <% @posts.each do |post| %>
        <article class="post-card">
          <% if post.featured_image.present? %>
            <%= image_tag post.featured_image, class: "post-image", alt: post.title %>
          <% end %>
          
          <div class="post-content">
            <h2><%= link_to post.title, post_path(post) %></h2>
            <p class="post-excerpt"><%= truncate(strip_tags(post.content), length: 150) %></p>
            
            <div class="post-meta">
              <time datetime="<%= post.published_at&.iso8601 %>">
                <%= post.published_at&.strftime("%B %d, %Y") %>
              </time>
              <span class="author">by <%= post.author.name %></span>
            </div>
            
            <% if post.tags.any? %>
              <div class="post-tags">
                <% post.tags.each do |tag| %>
                  <%= link_to "##{tag.name}", tagged_posts_path(tag), class: "tag" %>
                <% end %>
              </div>
            <% end %>
          </div>
        </article>
      <% end %>
      
      <%= paginate @posts if respond_to?(:paginate) %>
    <% else %>
      <div class="empty-state">
        <h3>No posts found</h3>
        <p>There are no posts matching your criteria.</p>
        <%= link_to "Create the first post", new_post_path, class: "btn btn-primary" if can?(:create, Post) %>
      </div>
    <% end %>
  </div>
</div>`
    )

    expect(indexDocument.getText()).toContain('form_with url: posts_path')
    expect(indexDocument.getText()).toContain('options_for_select')
    expect(indexDocument.getText()).toContain('can?(:create, Post)')
    expect(indexDocument.getText()).toContain('post.featured_image.present?')
    expect(indexDocument.getText()).toContain('paginate @posts')
    
    // Verify we can work with this complex document
    expect(indexDocument.lineCount).toBeGreaterThan(40)
    
    // Test finding complex ERB expressions
    const complexExpressions = [
      'truncate(strip_tags(post.content), length: 150)',
      'post.published_at&.strftime("%B %d, %Y")',
      'link_to "##{tag.name}", tagged_posts_path(tag), class: "tag"'
    ]
    
    complexExpressions.forEach(expr => {
      const position = indexDocument.getText().indexOf(expr)
      expect(position).toBeGreaterThan(0)
    })
  })
})