# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"
require_relative "../../lib/herb/engine/remove_comments_visitor"
require_relative "../../lib/herb/engine/slots/visitor"

module Engine
  class RemoveCommentsVisitorTest < Minitest::Spec
    include SnapshotUtils

    def remove_comments_options
      {
        escape: false,
        visitors: [Herb::Engine::RemoveCommentsVisitor.new],
      }
    end

    test "visitor is not loaded when only requiring herb" do
      load_path = $LOAD_PATH.map { |path| "-I#{path}" }.join(" ")
      output = `#{Gem.ruby} #{load_path} -e 'require "herb"; print defined?(Herb::Engine::RemoveCommentsVisitor).inspect' 2>&1`

      assert_equal "nil", output
    end

    test "html comment - compilation" do
      template = "<div><!-- secret --></div>"

      assert_compiled_snapshot(template, remove_comments_options)
    end

    test "html comment - render" do
      template = "<div><!-- secret --></div>"

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "html comment on its own line - compilation" do
      template = <<~ERB
        <div>
          <!-- secret -->
          <p>Content</p>
        </div>
      ERB

      assert_compiled_snapshot(template, remove_comments_options)
    end

    test "html comment on its own line - render" do
      template = <<~ERB
        <div>
          <!-- secret -->
          <p>Content</p>
        </div>
      ERB

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "multi-line html comment - render" do
      template = <<~ERB
        <div>
          <!--
            a note
            over two lines
          -->
        </div>
      ERB

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "html comment containing markup - render" do
      template = "<div><!-- <p>disabled</p> --><p>Content</p></div>"

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "conditional comment - render" do
      template = '<!--[if lt IE 9]><script src="html5shiv.js"></script><![endif]--><p>Content</p>'

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "comment at the document, head and body level - render" do
      template = <<~ERB
        <!DOCTYPE html>
        <!-- a note -->
        <html>
          <head><!-- a note --><title>Title</title></head>
          <body><!-- a note --><p>Content</p></body>
        </html>
      ERB

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "comment inside an erb branch - compilation" do
      template = "<% if admin? %><!-- admin only --><p>Admin</p><% else %><!-- everyone --><p>User</p><% end %>"

      assert_compiled_snapshot(template, remove_comments_options)
    end

    test "comment inside an erb branch - render" do
      template = "<% if admin? %><!-- admin only --><p>Admin</p><% else %><!-- everyone --><p>User</p><% end %>"

      assert_evaluated_snapshot(template, { admin?: false }, remove_comments_options)
    end

    test "comment inside an erb block - compilation" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <!-- item -->
            <li><%= item %></li>
          <% end %>
        </ul>
      ERB

      assert_compiled_snapshot(template, remove_comments_options)
    end

    test "comment inside an erb block - render" do
      template = <<~ERB
        <ul>
          <% items.each do |item| %>
            <!-- item -->
            <li><%= item %></li>
          <% end %>
        </ul>
      ERB

      assert_evaluated_snapshot(template, { items: ["A", "B"] }, remove_comments_options)
    end

    test "erb comment - compilation" do
      template = <<~ERB
        <div>
          <%# a comment %>
          <% # another comment %>
          <p>Content</p>
        </div>
      ERB

      assert_compiled_snapshot(template, remove_comments_options)
    end

    test "erb comment - render" do
      template = <<~ERB
        <div>
          <%# a comment %>
          <% # another comment %>
          <p>Content</p>
        </div>
      ERB

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "erb comment in an attribute value - render" do
      template = '<div class="<%# a comment %>">Content</div>'

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "commented out erb output tag - render" do
      template = "<div><%#= raise('should not run') %></div>"

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "comment inside a script element is text and stays - render" do
      template = "<script>// <!-- keep this --></script><style>/* <!-- and this --> */</style>"

      assert_evaluated_snapshot(template, {}, remove_comments_options)
    end

    test "the comment is removed from the compiled output" do
      template = "<div><!-- secret --></div>"

      engine = Herb::Engine.new(template, remove_comments_options)

      assert_equal "<div></div>", eval(engine.src)
    end

    test "without the visitor the comment is emitted" do
      template = "<div><!-- secret --></div>"

      engine = Herb::Engine.new(template, escape: false)

      assert_equal template, eval(engine.src)
    end

    test "whitespace around a comment is preserved" do
      template = "<span>One</span> <!-- between --> <span>Two</span>"

      engine = Herb::Engine.new(template, remove_comments_options)

      assert_equal "<span>One</span>  <span>Two</span>", eval(engine.src)
    end

    test "erb inside a removed comment never runs" do
      template = "<div><!-- <%= raise('should not run') %> --></div>"

      engine = Herb::Engine.new(template, remove_comments_options)

      assert_equal "<div></div>", eval(engine.src)
    end

    test "a template that is only a comment compiles to an empty string" do
      template = "<!-- nothing else -->"

      engine = Herb::Engine.new(template, remove_comments_options)

      assert_equal "", eval(engine.src)
    end

    test "herb directives and strict locals are kept" do
      template = <<~ERB
        <%# locals: (title:) %>
        <%# herb:state (pending: false) %>
        <%#- herb:disable html-tag-name-lowercase -%>
        <%-# herb:disable erb-no-empty-tags %>
        <%# a note %>
        <% # another note %>
        <!-- an html note -->
        <div><%# herb:key title %><%= title %></div>
      ERB

      result = Herb.parse(template)

      result.value.accept(Herb::Engine::RemoveCommentsVisitor.new)

      contents = []

      collect = lambda do |node|
        contents << node.content&.value if node.is_a?(Herb::AST::ERBContentNode)
        node.compact_child_nodes.each { |child| collect.call(child) }
      end

      collect.call(result.value)

      assert_equal [
        " locals: (title:) ",
        " herb:state (pending: false) ",
        "- herb:disable html-tag-name-lowercase ",
        "# herb:disable erb-no-empty-tags ",
        " herb:key title ",
        " title "
      ], contents
    end

    test "a marker written into the template is kept" do
      template = "<!--herb-slot:0--><!--/herb-slot:0--><!-- a note -->"

      engine = Herb::Engine.new(template, remove_comments_options)

      assert_equal "<!--herb-slot:0--><!--/herb-slot:0-->", eval(engine.src)
    end

    test "keeps the markers the slots visitor leaves behind, running before it - render" do
      template = "<!-- a note --><p>Hi <%= @name %>!</p>"

      assert_evaluated_snapshot(
        template,
        { "@name" => "Marco" },
        {
          filename: "app/views/test.html.erb",
          visitors: [Herb::Engine::RemoveCommentsVisitor.new, Herb::Engine::Slots::Visitor.new],
        }
      )
    end

    test "keeps the markers the slots visitor leaves behind, running after it - render" do
      template = "<!-- a note --><p>Hi <%= @name %>!</p>"

      assert_evaluated_snapshot(
        template,
        { "@name" => "Marco" },
        {
          filename: "app/views/test.html.erb",
          visitors: [Herb::Engine::Slots::Visitor.new, Herb::Engine::RemoveCommentsVisitor.new],
        }
      )
    end

    test "the visitor removes every comment node from the AST" do
      template = <<~ERB
        <!-- document -->
        <%# document %>
        <div>
          <!-- element -->
          <%# element %>
          <% if true %>
            <!-- branch -->
            <%# branch %>
          <% end %>
          <% [1].each do %>
            <!-- block -->
            <%# block %>
          <% end %>
        </div>
      ERB

      result = Herb.parse(template)

      result.value.accept(Herb::Engine::RemoveCommentsVisitor.new)

      comments = []

      collect = lambda do |node|
        comments << node if node.is_a?(Herb::AST::HTMLCommentNode) || node.is_a?(Herb::AST::ERBContentNode)
        node.compact_child_nodes.each { |child| collect.call(child) }
      end

      collect.call(result.value)

      assert_empty comments
    end
  end
end
