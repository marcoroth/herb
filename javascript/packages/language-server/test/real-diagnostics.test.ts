import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Connection, DiagnosticSeverity } from 'vscode-languageserver/node'
import { Readable, Writable } from 'stream'
import path from 'path'
import fs from 'fs'

// Import real components without mocking (except for the WASM dependency)
import { Diagnostics } from '../src/diagnostics'
import { DocumentService } from '../src/document_service'
import { createMockConnection } from './helpers/mock-connection'

describe('Real Diagnostics Tests', () => {
  let connection: Connection
  let documentService: DocumentService
  let diagnostics: Diagnostics
  let testWorkspace: string

  beforeEach(() => {
    connection = createMockConnection()
    documentService = new DocumentService(connection)
    diagnostics = new Diagnostics(connection, documentService)
    
    // Set up test workspace
    testWorkspace = path.join(__dirname, 'fixtures', 'test-workspace')
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true })
    }
  })

  afterEach(() => {
    // Clean up any temporary files if needed
  })

  it('should handle real ERB documents without throwing', () => {
    const validERB = `
<html>
  <head><title><%= @title %></title></head>
  <body>
    <% if @user %>
      <h1>Hello <%= @user.name %>!</h1>
    <% end %>
  </body>
</html>`

    const document = TextDocument.create(
      'file:///test.html.erb',
      'erb',
      1,
      validERB
    )

    // This should not throw with real implementation
    expect(() => diagnostics.validate(document)).not.toThrow()
  })

  it('should handle complex real-world ERB syntax', () => {
    const complexERB = `
<!DOCTYPE html>
<html>
<head>
  <title><%= @page_title || "Default Title" %></title>
  <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
</head>
<body>
  <header>
    <% if user_signed_in? %>
      <nav>
        <%= link_to "Home", root_path %>
        <%= link_to "Profile", user_path(current_user) %>
        <%= link_to "Logout", logout_path, method: :delete, 
                    data: { confirm: "Are you sure?" } %>
      </nav>
    <% else %>
      <%= link_to "Login", login_path, class: "btn btn-primary" %>
    <% end %>
  </header>

  <main>
    <% flash.each do |type, message| %>
      <div class="alert alert-<%= type %>">
        <%= message %>
      </div>
    <% end %>

    <%= yield %>

    <% if @posts&.any? %>
      <section class="posts">
        <% @posts.each_with_index do |post, index| %>
          <article class="post <%= 'featured' if index == 0 %>">
            <h2><%= link_to post.title, post_path(post) %></h2>
            <p><%= truncate(post.excerpt, length: 150) %></p>
            <time datetime="<%= post.published_at&.iso8601 %>">
              <%= post.published_at&.strftime("%B %d, %Y") %>
            </time>
            
            <% if post.tags.present? %>
              <div class="tags">
                <% post.tags.each do |tag| %>
                  <%= link_to "##{tag.name}", tag_path(tag) %>
                <% end %>
              </div>
            <% end %>
          </article>
        <% end %>
      </section>
    <% else %>
      <p>No posts found.</p>
    <% end %>
  </main>

  <footer>
    <%= render "shared/footer" %>
  </footer>
</body>
</html>`

    const document = TextDocument.create(
      'file:///complex.html.erb',
      'erb',
      1,
      complexERB
    )

    // Should handle complex syntax without errors
    expect(() => diagnostics.validate(document)).not.toThrow()
  })

  it('should process documents with Rails helpers and methods', () => {
    const railsERB = `
<%= form_with(model: @user, url: registration_path, local: true) do |form| %>
  <div class="field">
    <%= form.label :email %>
    <%= form.email_field :email, required: true, class: "form-control" %>
  </div>

  <div class="field">
    <%= form.label :password %>
    <%= form.password_field :password, required: true, 
            minlength: 6, class: "form-control" %>
  </div>

  <div class="field">
    <%= form.check_box :terms_accepted %>
    <%= form.label :terms_accepted, "I accept the terms" %>
  </div>

  <div class="actions">
    <%= form.submit "Sign Up", class: "btn btn-primary" %>
  </div>
<% end %>

<%= link_to "Back", users_path, class: "btn btn-secondary" %>
`

    const document = TextDocument.create(
      'file:///form.html.erb',
      'erb',
      1,
      railsERB
    )

    expect(() => diagnostics.validate(document)).not.toThrow()
  })

  it('should handle documents with Ruby blocks and iterations', () => {
    const iterationERB = `
<div class="users-grid">
  <% @users.includes(:posts).each do |user| %>
    <div class="user-card" data-user-id="<%= user.id %>">
      <h3><%= user.full_name %></h3>
      <p><%= user.email %></p>
      
      <% if user.posts.any? %>
        <div class="post-count">
          Posts: <%= pluralize(user.posts.count, 'post') %>
        </div>
        
        <ul class="recent-posts">
          <% user.posts.recent.limit(3).each do |post| %>
            <li>
              <%= link_to truncate(post.title, length: 30), post_path(post) %>
              <small>(<%= time_ago_in_words(post.created_at) %> ago)</small>
            </li>
          <% end %>
        </ul>
      <% else %>
        <p class="no-posts">No posts yet</p>
      <% end %>
      
      <%= link_to "View Profile", user_path(user), class: "btn btn-sm" %>
    </div>
  <% end %>
</div>

<% if @users.empty? %>
  <div class="empty-state">
    <h2>No users found</h2>
    <%= link_to "Invite Users", new_invitation_path, class: "btn btn-primary" %>
  </div>
<% end %>`

    const document = TextDocument.create(
      'file:///users.html.erb',
      'erb',
      1,
      iterationERB
    )

    expect(() => diagnostics.validate(document)).not.toThrow()
  })

  it('should work with real file content from fixtures', () => {
    const simpleFilePath = path.join(testWorkspace, 'simple.html.erb')
    const complexFilePath = path.join(testWorkspace, 'complex.html.erb')
    
    if (fs.existsSync(simpleFilePath)) {
      const simpleContent = fs.readFileSync(simpleFilePath, 'utf8')
      const simpleDoc = TextDocument.create(
        `file://${simpleFilePath}`,
        'erb',
        1,
        simpleContent
      )
      
      expect(() => diagnostics.validate(simpleDoc)).not.toThrow()
      expect(simpleDoc.getText()).toContain('Hello World')
    }
    
    if (fs.existsSync(complexFilePath)) {
      const complexContent = fs.readFileSync(complexFilePath, 'utf8')
      const complexDoc = TextDocument.create(
        `file://${complexFilePath}`,
        'erb',
        1,
        complexContent
      )
      
      expect(() => diagnostics.validate(complexDoc)).not.toThrow()
      expect(complexDoc.getText()).toContain('@post.title')
    }
  })

  it('should handle refresh operations on real documents', () => {
    const document = TextDocument.create(
      'file:///refresh-test.html.erb',
      'erb',
      1,
      '<%= @test_variable %>'
    )

    expect(() => diagnostics.refreshDocument(document)).not.toThrow()
  })

  it('should handle multiple documents in refresh all', () => {
    const doc1 = TextDocument.create('file:///doc1.html.erb', 'erb', 1, '<%= "doc1" %>')
    const doc2 = TextDocument.create('file:///doc2.html.erb', 'erb', 1, '<%= "doc2" %>')
    
    // Mock the document service to return our test documents
    const originalGetAll = documentService.getAll
    documentService.getAll = () => [doc1, doc2]
    
    expect(() => diagnostics.refreshAllDocuments()).not.toThrow()
    
    // Restore original method
    documentService.getAll = originalGetAll
  })

  it('should create and push diagnostics with real data', () => {
    const document = TextDocument.create(
      'file:///diagnostic-test.html.erb',
      'erb',
      1,
      '<%= "test diagnostic" %>'
    )

    const range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 4 }
    }

    const diagnostic = diagnostics.pushDiagnostic(
      'Test diagnostic message',
      'test-code',
      range,
      document,
      { testData: 'real data' },
      DiagnosticSeverity.Warning
    )

    expect(diagnostic).toBeDefined()
    expect(diagnostic.message).toBe('Test diagnostic message')
    expect(diagnostic.code).toBe('test-code')
    expect(diagnostic.severity).toBe(DiagnosticSeverity.Warning)
    expect(diagnostic.range).toEqual(range)
    expect(diagnostic.data).toEqual({ testData: 'real data' })
    expect(diagnostic.source).toContain('Herb LSP')
  })

  it('should handle edge cases in ERB syntax', () => {
    const edgeCases = [
      // Empty ERB tags
      '<% %>',
      
      // Nested quotes
      '<%= "He said, \\"Hello world!\\"" %>',
      
      // Multi-line Ruby code
      `<%
        if condition
          do_something
        else
          do_something_else
        end
      %>`,
      
      // ERB with HTML attributes
      '<div class="<%= @css_class %>" data-id="<%= @user.id %>">Content</div>',
      
      // Complex expressions
      '<%= @users.where(active: true).includes(:posts).map(&:name).join(", ") %>',
      
      // ERB comments
      '<%# This is a comment %><%= "visible content" %>'
    ]

    edgeCases.forEach((erbCode, index) => {
      const document = TextDocument.create(
        `file:///edge-case-${index}.html.erb`,
        'erb',
        1,
        erbCode
      )

      expect(() => diagnostics.validate(document)).not.toThrow()
    })
  })
})