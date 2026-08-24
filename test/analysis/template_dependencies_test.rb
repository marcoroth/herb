# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/template_dependencies"

require "tmpdir"
require "fileutils"

class TemplateDependenciesTest < Minitest::Spec
  def setup
    @project_path = Dir.mktmpdir("herb_deps_test")
    @view_root = File.join(@project_path, "app", "views")
    @helpers_dir = File.join(@project_path, "app", "helpers")
    FileUtils.mkdir_p(File.join(@view_root, "posts"))
    FileUtils.mkdir_p(File.join(@view_root, "shared"))
    FileUtils.mkdir_p(@helpers_dir)
  end

  def teardown
    FileUtils.rm_rf(@project_path)
  end

  def analyzer
    Herb::Analysis::TemplateDependencies.new(@project_path)
  end

  def write_template(path, content)
    full_path = File.join(@view_root, path)
    FileUtils.mkdir_p(File.dirname(full_path))
    File.write(full_path, content)
    full_path
  end

  def write_helper(path, content)
    full_path = File.join(@helpers_dir, path)
    File.write(full_path, content)
    full_path
  end

  test "traces state through a rename into a partial" do
    entry = write_template("posts/show.html.erb", '<%= render "posts/byline", author: @post.user %>')
    write_template("posts/_byline.html.erb", "<span><%= author.name %></span>")

    flow = analyzer.state_flow(entry, "@post")

    assert_equal ["@post"], flow.names
    assert_equal 1, flow.children.size
    assert_equal ["author"], flow.children.first.names
    assert_equal({ "author" => "@post.user" }, flow.children.first.via)
  end

  test "traces state through two renames" do
    entry = write_template("posts/show.html.erb", '<%= render "posts/byline", author: @post.user %>')
    write_template("posts/_byline.html.erb", '<%= render "posts/avatar", user: author %>')
    write_template("posts/_avatar.html.erb", "<span><%= user.name %></span>")

    flow = analyzer.state_flow(entry, "@post")
    avatar = flow.children.first.children.first

    assert_equal ["user"], avatar.names
    assert_equal(["user.name"], avatar.nodes.map { |node| node[:expression] })
  end

  test "reports the nodes each template renders from the state" do
    entry = write_template("posts/show.html.erb", "<h1><%= @post.title %></h1>")

    flow = analyzer.state_flow(entry, "@post")

    assert_equal(["@post.title"], flow.nodes.map { |node| node[:expression] })
  end

  test "branches when state flows into two partials" do
    entry = write_template("posts/show.html.erb", '<%= render "posts/byline", author: @post.user %><%= render "posts/body", text: @post.body %>')
    write_template("posts/_byline.html.erb", "<span><%= author %></span>")
    write_template("posts/_body.html.erb", "<p><%= text %></p>")

    flow = analyzer.state_flow(entry, "@post")

    assert_equal ["author", "text"], flow.children.map { |child| child.names.first }.sort
  end

  test "carries the item name into a collection render" do
    entry = write_template("posts/show.html.erb", '<%= render partial: "posts/comment", collection: @post.comments %>')
    write_template("posts/_comment.html.erb", "<li><%= comment %></li>")

    flow = analyzer.state_flow(entry, "@post")

    assert_equal ["comment"], flow.children.first.names
  end

  test "does not trace state the template never reads" do
    entry = write_template("posts/show.html.erb", "<h1><%= @post.title %></h1>")

    assert_nil analyzer.state_flow(entry, "@user")
  end

  test "stops instead of looping when partials render each other" do
    entry = write_template("posts/show.html.erb", '<%= render "posts/a", value: @post %>')
    write_template("posts/_a.html.erb", '<%= render "posts/b", value: value %>')
    write_template("posts/_b.html.erb", '<%= render "posts/a", value: value %>')

    flow = analyzer.state_flow(entry, "@post")

    assert_equal ["value"], flow.children.first.names
  end

  test "traces state into a partial named relative to the rendering template" do
    entry = write_template("posts/show.html.erb", '<%= render "header", post: @post %>')
    sibling = write_template("posts/_header.html.erb", "<h1><%= post.title %></h1>")

    assert_equal [entry, sibling].sort, analyzer.affected_templates(entry, "@post").sort
  end

  test "traces state into a partial in the application directory" do
    entry = write_template("posts/show.html.erb", '<%= render "flash", post: @post %>')
    shared = write_template("application/_flash.html.erb", "<p><%= post %></p>")

    assert_equal [entry, shared].sort, analyzer.affected_templates(entry, "@post").sort
  end

  test "traces state in a project that does not keep templates in app/views" do
    flat_root = Dir.mktmpdir("herb_deps_flat")

    begin
      FileUtils.mkdir_p(File.join(flat_root, "posts"))

      entry = File.join(flat_root, "posts", "show.html.erb")
      File.write(entry, '<%= @post.title %><%= render "posts/header", post: @post %>')
      File.write(File.join(flat_root, "posts", "_header.html.erb"), "<h1><%= post.name %></h1>")

      a = Herb::Analysis::TemplateDependencies.new(flat_root)

      assert_equal ["@post"], a.analyze(entry).instance_variables

      affected = a.affected_templates(entry, "@post")

      assert_equal [File.join(flat_root, "posts", "_header.html.erb"), entry].sort, affected.sort
    ensure
      FileUtils.rm_rf(flat_root)
    end
  end

  test "detects instance variables" do
    path = write_template("posts/show.html.erb", "<h1><%= @post.title %></h1><p><%= @user.name %></p>")

    result = analyzer.analyze(path)

    assert_equal ["@post", "@user"], result.instance_variables
  end

  test "detects constants with method calls" do
    path = write_template("posts/show.html.erb", "<%= Current.user %><%= Post.count %>")

    result = analyzer.analyze(path)

    assert_equal ["Current.user", "Post.count"], result.constants
  end

  test "detects strict locals" do
    path = write_template("posts/_card.html.erb", "<%# locals: (title:, body:) %>\n<h1><%= title %></h1>")

    result = analyzer.analyze(path)

    assert_equal ["body", "title"], result.locals_declared
  end

  test "detects locals passed to render calls" do
    write_template("shared/_header.html.erb", "<h1>Header</h1>")
    path = write_template("posts/show.html.erb", '<%= render "shared/header", title: @post.title %>')

    result = analyzer.analyze(path)

    assert_equal "@post.title", result.locals_received["title"]
  end

  test "detects known ActionView helpers" do
    path = write_template("posts/show.html.erb", '<%= link_to "Home", "/" %>')

    result = analyzer.analyze(path)

    assert_equal ["link_to"], result.helper_calls
  end

  test "detects custom helpers after scanning" do
    write_helper("application_helper.rb", <<~RUBY)
      module ApplicationHelper
        def markdown(text)
          text
        end
      end
    RUBY

    path = write_template("posts/show.html.erb", "<%= markdown(@post.body) %>")

    a = analyzer
    a.scan_helpers!
    result = a.analyze(path)

    assert_equal ["markdown"], result.helper_calls
    assert_empty result.unknown_calls
  end

  test "flags unknown method calls" do
    path = write_template("posts/show.html.erb", "<%= current_user.name %>")

    result = analyzer.analyze(path)

    assert_equal ["current_user"], result.unknown_calls
  end

  test "does not flag declared locals as unknown" do
    path = write_template("posts/_card.html.erb", "<%# locals: (title:) %>\n<%= title %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
    assert_equal ["title"], result.locals_declared
  end

  test "detects instance variables in conditionals" do
    path = write_template("posts/show.html.erb", "<% if @admin %><p>Admin</p><% end %>")

    result = analyzer.analyze(path)

    assert_equal ["@admin"], result.instance_variables
  end

  test "detects constants in conditionals" do
    path = write_template("posts/show.html.erb", "<% if Current.user %><p>Logged in</p><% end %>")

    result = analyzer.analyze(path)

    assert_equal ["Current.user"], result.constants
  end

  test "tracks instance variables from render local values" do
    write_template("shared/_header.html.erb", "<h1>Header</h1>")
    path = write_template("posts/show.html.erb", '<%= render "shared/header", user: @current_user %>')

    result = analyzer.analyze(path)

    assert_equal ["@current_user"], result.instance_variables
    assert_equal "@current_user", result.locals_received["user"]
  end

  test "detects collection expression dependencies" do
    write_template("posts/_post.html.erb", "<div>Post</div>")
    path = write_template("posts/index.html.erb", '<%= render partial: "posts/post", collection: @posts %>')

    result = analyzer.analyze(path)

    assert_equal ["@posts"], result.instance_variables
  end

  test "instance variables are deduplicated" do
    path = write_template("posts/show.html.erb", "<%= @post.title %><%= @post.body %><%= @post.author %>")

    result = analyzer.analyze(path)

    assert_equal(1, result.instance_variables.count { |v| v == "@post" })
  end

  test "tracks render calls with partials and locals" do
    write_template("shared/_header.html.erb", "<h1>Header</h1>")
    path = write_template("posts/show.html.erb", '<%= render "shared/header", title: @post.title, user: @user %>')

    result = analyzer.analyze(path)

    assert_equal 1, result.render_calls.size
    assert_equal "shared/header", result.render_calls.first[:partial]
    assert_equal "@post.title", result.render_calls.first[:locals]["title"]
    assert_equal "@user", result.render_calls.first[:locals]["user"]
  end

  test "does not flag template-defined locals as unknown" do
    path = write_template("posts/show.html.erb", "<% title = @post.title %>\n<%= title %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
    assert_equal ["@post"], result.instance_variables
  end

  test "does not flag block parameters as unknown" do
    path = write_template("posts/index.html.erb", "<% @posts.each do |post| %>\n<%= post.name %>\n<% end %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
    assert_equal ["@posts"], result.instance_variables
  end

  test "does not flag nested block parameters as unknown" do
    path = write_template("posts/index.html.erb", "<% @posts.each_with_index do |post, index| %>\n<%= post.name %><%= index %>\n<% end %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
  end

  test "detects instance variables inside string interpolation" do
    path = write_template("posts/show.html.erb", '<%= "Hello #{@user.name}" %>')

    result = analyzer.analyze(path)

    assert_equal ["@user"], result.instance_variables
  end

  test "conditional assignment registers as local" do
    path = write_template("posts/show.html.erb", "<% title ||= \"Default\" %>\n<%= title %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
  end

  test "operator assignment registers as local" do
    path = write_template("posts/show.html.erb", "<% count += 1 %>\n<%= count %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
  end

  test "multiple assignment registers all locals" do
    path = write_template("posts/show.html.erb", "<% a, b = [1, 2] %>\n<%= a %><%= b %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
  end

  test "detects multiple instance variables in ternary" do
    path = write_template("posts/show.html.erb", '<%= @admin ? @post.title : "Hidden" %>')

    result = analyzer.analyze(path)

    assert_equal ["@admin", "@post"], result.instance_variables
  end

  test "block parameters are scoped and not treated as template-wide locals" do
    path = write_template("posts/index.html.erb",
                          "<%= user %>\n<% @users.each do |user| %>\n<%= user %>\n<% end %>\n<%= user %>")

    result = analyzer.analyze(path)

    assert_equal ["user"], result.unknown_calls
    assert_equal ["@users"], result.instance_variables
  end

  test "affected_templates traces state through render graph" do
    entry = write_template("posts/show.html.erb", '<%= @post.title %><%= render "posts/header", post: @post %>')
    write_template("posts/_header.html.erb", "<h1><%= post.name %></h1>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    assert_equal [File.join(@view_root, "posts/_header.html.erb"), File.join(@view_root, "posts/show.html.erb")].sort, affected.sort
  end

  test "affected_templates does not include unrelated templates" do
    entry = write_template("posts/show.html.erb", '<%= @post.title %><%= render "posts/header", post: @post %>')
    write_template("posts/_header.html.erb", "<h1><%= post.name %></h1>")
    write_template("pages/about.html.erb", "<h1>About</h1>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    assert_equal [File.join(@view_root, "posts/_header.html.erb"), File.join(@view_root, "posts/show.html.erb")].sort, affected.sort
  end

  test "affected_templates traces through nested renders" do
    entry = write_template("posts/show.html.erb", '<%= render "posts/header", post: @post %>')
    write_template("posts/_header.html.erb", '<%= render "posts/title", title: post.title %>')
    write_template("posts/_title.html.erb", "<h1><%= title %></h1>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    assert_equal [File.join(@view_root, "posts/_header.html.erb"), File.join(@view_root, "posts/_title.html.erb"), File.join(@view_root, "posts/show.html.erb")].sort, affected.sort
  end

  test "affected_templates handles constants" do
    entry = write_template("posts/index.html.erb", "<%= Post.count %>")

    a = analyzer
    affected = a.affected_templates(entry, "Post.count")

    assert_equal [File.join(@view_root, "posts/index.html.erb")].sort, affected.sort
  end

  test "dependency_index maps state to affected nodes" do
    path = write_template("posts/show.html.erb", "<div><h1><%= @post.title %></h1><p><%= @post.body %></p></div>")

    a = analyzer
    index = a.dependency_index(path)

    assert index.key?("@post")
    assert_equal 2, index["@post"].size
    assert_equal :text_content, index["@post"][0][:type]
    assert_equal :text_content, index["@post"][1][:type]
  end

  test "dependency_index includes attribute nodes" do
    path = write_template("posts/show.html.erb", '<div class="<%= @active ? "on" : "off" %>">Content</div>')

    a = analyzer
    index = a.dependency_index(path)

    assert index.key?("@active")
    attr_node = index["@active"].find { |n| n[:type] == :attribute_value }
    assert attr_node
    assert_equal "class", attr_node[:attribute]
  end

  test "traces state into a partial rendered inside an each block" do
    write_template("posts/_card.html.erb", "<div><%= card.title %></div>")
    entry = write_template("posts/index.html.erb", %(<% @posts.each do |post| %><%= render "posts/card", card: post %><% end %>))

    affected = analyzer.affected_templates(entry, "@posts")

    assert_equal [File.join(@view_root, "posts/_card.html.erb"), File.join(@view_root, "posts/index.html.erb")].sort, affected.sort
  end

  test "names the local an each block's partial received the state as" do
    write_template("posts/_card.html.erb", "<div><%= card.title %></div>")
    entry = write_template("posts/index.html.erb", %(<% @posts.each do |post| %><%= render "posts/card", card: post %><% end %>))

    flow = analyzer.state_flow(entry, "@posts")
    child = flow.children.find { |node| File.basename(node.file) == "_card.html.erb" }

    assert child
    assert_equal ["card"], child.names.to_a
  end

  test "does not trace a block parameter used after its block closed" do
    write_template("posts/_card.html.erb", "<div><%= card.title %></div>")
    entry = write_template("posts/index.html.erb", %(<% @posts.each do |post| %><% end %><%= render "posts/card", card: post %>))

    affected = analyzer.affected_templates(entry, "@posts")

    assert_equal [File.join(@view_root, "posts/index.html.erb")].sort, affected.sort
  end

  test "does not trace state through a block that runs once" do
    write_template("posts/_field.html.erb", "<div><%= card %></div>")
    entry = write_template("posts/index.html.erb", %(<% form_with model: @post do |f| %><%= render "posts/field", card: f %><% end %>))

    affected = analyzer.affected_templates(entry, "@post")

    assert_equal [File.join(@view_root, "posts/index.html.erb")].sort, affected.sort
  end

  test "affected_nodes tells a loop apart from a block that runs once" do
    loop_path = write_template("posts/index.html.erb", "<ul><% @items.each do |i| %><li><%= i %></li><% end %></ul>")
    form_path = write_template("posts/form.html.erb", "<% form_with model: @post do |f| %><%= f.label %><% end %>")

    assert_equal :iteration, analyzer.affected_nodes(loop_path, "@items").first[:type]
    assert_equal :expression, analyzer.affected_nodes(form_path, "@post").first[:type]
  end

  test "affected_nodes follows state into a local assigned from it" do
    path = write_template("posts/index.html.erb", "<% total = @items.size %><p><%= total %></p>")

    expressions = analyzer.affected_nodes(path, "@items").map { |node| node[:expression] }

    assert_equal ["total = @items.size", "total"], expressions
  end

  test "affected_nodes follows state through a chain of assignments" do
    path = write_template("posts/index.html.erb", "<% a = @items.size %><% b = a * 2 %><p><%= b %></p>")

    expressions = analyzer.affected_nodes(path, "@items").map { |node| node[:expression] }

    assert_equal ["a = @items.size", "b = a * 2", "b"], expressions
  end

  test "affected_nodes leaves a local assigned from something else" do
    path = write_template("posts/index.html.erb", "<% other = 5 %><p><%= other %></p>")

    assert_empty analyzer.affected_nodes(path, "@items")
  end

  test "affected_nodes does not take a comparison for an assignment" do
    path = write_template("posts/index.html.erb", "<% if @items == other %><p><%= other %></p><% end %>")

    expressions = analyzer.affected_nodes(path, "@items").map { |node| node[:expression] }

    assert_equal ["if @items == other"], expressions
  end

  test "affected_nodes stops a local assigned inside a block at the end of it" do
    path = write_template("posts/index.html.erb", "<% @rows.each do |r| %><% inner = r.x %><%= inner %><% end %><%= inner %>")

    expressions = analyzer.affected_nodes(path, "@rows").map { |node| node[:expression] }

    assert_equal ["@rows.each do |r|", "inner = r.x", "inner"], expressions
  end

  test "dependency_index reports what a partial's declared locals reach" do
    path = write_template("posts/_card.html.erb", "<%# locals: (query:, page: 1) %>\n<p><%= query %></p><span><%= page %></span>")

    index = analyzer.dependency_index(path)

    assert_equal ["page", "query"], index.keys.sort
  end

  test "affected_nodes follows state through a block parameter" do
    path = write_template("posts/index.html.erb", "<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>")

    nodes = analyzer.affected_nodes(path, "@items")
    expressions = nodes.map { |node| node[:expression] }

    assert_equal ["@items.each do |item|", "item.name"], expressions
  end

  test "affected_nodes follows state through every parameter a block binds" do
    path = write_template("posts/index.html.erb", "<ul><% @rows.each_with_index do |row, i| %><li><%= i %>: <%= row.title %></li><% end %></ul>")

    expressions = analyzer.affected_nodes(path, "@rows").map { |node| node[:expression] }

    assert_equal ["@rows.each_with_index do |row, i|", "i", "row.title"], expressions
  end

  test "affected_nodes leaves an expression a block parameter does not reach" do
    path = write_template("posts/index.html.erb", "<div><% @items.each do |item| %><%= other %><% end %></div>")

    expressions = analyzer.affected_nodes(path, "@items").map { |node| node[:expression] }

    assert_equal ["@items.each do |item|"], expressions
  end

  test "affected_nodes stops a block parameter at the end of its block" do
    path = write_template("posts/index.html.erb", "<div><% @items.each do |item| %><%= item.name %><% end %><%= item %></div>")

    nodes = analyzer.affected_nodes(path, "@items")

    assert_equal(1, nodes.count { |node| node[:expression] == "item.name" })
    assert_equal(0, nodes.count { |node| node[:expression] == "item" })
  end

  test "affected_nodes does not confuse a state name with a longer one" do
    path = write_template("posts/show.html.erb", "<div><%= @post.title %></div><div><%= @posts.count %></div>")

    expressions = analyzer.affected_nodes(path, "@post").map { |node| node[:expression] }

    assert_equal ["@post.title"], expressions
  end

  test "dependency_index marks if-blocks containing state as conditional" do
    path = write_template("posts/show.html.erb", "<div><% if @admin %><%= @post.name %><% end %></div>")

    a = analyzer
    index = a.dependency_index(path)

    assert index.key?("@post")
    types = index["@post"].map { |n| n[:type] }
    assert_equal [:conditional, :text_content], types

    assert index.key?("@admin")
    assert_equal :conditional, index["@admin"].first[:type]
  end

  test "affected_templates returns empty when state not used in entry point" do
    entry = write_template("posts/show.html.erb", "<%= @title %>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    assert_empty affected
  end
end
