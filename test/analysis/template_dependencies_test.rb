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
    assert_includes avatar.nodes.map { |node| node[:expression] }, "user.name"
  end

  test "reports the nodes each template renders from the state" do
    entry = write_template("posts/show.html.erb", "<h1><%= @post.title %></h1>")

    flow = analyzer.state_flow(entry, "@post")

    assert_includes flow.nodes.map { |node| node[:expression] }, "@post.title"
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

    assert_includes flow.children.first.names, "comment"
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

    assert_includes analyzer.affected_templates(entry, "@post"), sibling
  end

  test "traces state into a partial in the application directory" do
    entry = write_template("posts/show.html.erb", '<%= render "flash", post: @post %>')
    shared = write_template("application/_flash.html.erb", "<p><%= post %></p>")

    assert_includes analyzer.affected_templates(entry, "@post"), shared
  end

  test "traces state in a project that does not keep templates in app/views" do
    flat_root = Dir.mktmpdir("herb_deps_flat")

    begin
      FileUtils.mkdir_p(File.join(flat_root, "posts"))

      entry = File.join(flat_root, "posts", "show.html.erb")
      File.write(entry, '<%= @post.title %><%= render "posts/header", post: @post %>')
      File.write(File.join(flat_root, "posts", "_header.html.erb"), "<h1><%= post.name %></h1>")

      a = Herb::Analysis::TemplateDependencies.new(flat_root)

      assert_includes a.analyze(entry).instance_variables, "@post"

      affected = a.affected_templates(entry, "@post")

      assert_includes affected, entry
      assert_includes affected, File.join(flat_root, "posts", "_header.html.erb")
    ensure
      FileUtils.rm_rf(flat_root)
    end
  end

  test "detects instance variables" do
    path = write_template("posts/show.html.erb", "<h1><%= @post.title %></h1><p><%= @user.name %></p>")

    result = analyzer.analyze(path)

    assert_includes result.instance_variables, "@post"
    assert_includes result.instance_variables, "@user"
  end

  test "detects constants with method calls" do
    path = write_template("posts/show.html.erb", "<%= Current.user %><%= Post.count %>")

    result = analyzer.analyze(path)

    assert_includes result.constants, "Current.user"
    assert_includes result.constants, "Post.count"
  end

  test "detects strict locals" do
    path = write_template("posts/_card.html.erb", "<%# locals: (title:, body:) %>\n<h1><%= title %></h1>")

    result = analyzer.analyze(path)

    assert_includes result.locals_declared, "title"
    assert_includes result.locals_declared, "body"
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

    assert_includes result.helper_calls, "link_to"
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

    assert_includes result.helper_calls, "markdown"
    refute_includes result.unknown_calls, "markdown"
  end

  test "flags unknown method calls" do
    path = write_template("posts/show.html.erb", "<%= current_user.name %>")

    result = analyzer.analyze(path)

    assert_includes result.unknown_calls, "current_user"
  end

  test "does not flag declared locals as unknown" do
    path = write_template("posts/_card.html.erb", "<%# locals: (title:) %>\n<%= title %>")

    result = analyzer.analyze(path)

    assert_empty result.unknown_calls
    assert_includes result.locals_declared, "title"
  end

  test "detects instance variables in conditionals" do
    path = write_template("posts/show.html.erb", "<% if @admin %><p>Admin</p><% end %>")

    result = analyzer.analyze(path)

    assert_includes result.instance_variables, "@admin"
  end

  test "detects constants in conditionals" do
    path = write_template("posts/show.html.erb", "<% if Current.user %><p>Logged in</p><% end %>")

    result = analyzer.analyze(path)

    assert_includes result.constants, "Current.user"
  end

  test "tracks instance variables from render local values" do
    write_template("shared/_header.html.erb", "<h1>Header</h1>")
    path = write_template("posts/show.html.erb", '<%= render "shared/header", user: @current_user %>')

    result = analyzer.analyze(path)

    assert_includes result.instance_variables, "@current_user"
    assert_equal "@current_user", result.locals_received["user"]
  end

  test "detects collection expression dependencies" do
    write_template("posts/_post.html.erb", "<div>Post</div>")
    path = write_template("posts/index.html.erb", '<%= render partial: "posts/post", collection: @posts %>')

    result = analyzer.analyze(path)

    assert_includes result.instance_variables, "@posts"
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

    refute_includes result.unknown_calls, "title"
    assert_includes result.instance_variables, "@post"
  end

  test "does not flag block parameters as unknown" do
    path = write_template("posts/index.html.erb", "<% @posts.each do |post| %>\n<%= post.name %>\n<% end %>")

    result = analyzer.analyze(path)

    refute_includes result.unknown_calls, "post"
    assert_includes result.instance_variables, "@posts"
  end

  test "does not flag nested block parameters as unknown" do
    path = write_template("posts/index.html.erb", "<% @posts.each_with_index do |post, index| %>\n<%= post.name %><%= index %>\n<% end %>")

    result = analyzer.analyze(path)

    refute_includes result.unknown_calls, "post"
    refute_includes result.unknown_calls, "index"
  end

  test "detects instance variables inside string interpolation" do
    path = write_template("posts/show.html.erb", '<%= "Hello #{@user.name}" %>')

    result = analyzer.analyze(path)

    assert_includes result.instance_variables, "@user"
  end

  test "conditional assignment registers as local" do
    path = write_template("posts/show.html.erb", "<% title ||= \"Default\" %>\n<%= title %>")

    result = analyzer.analyze(path)

    refute_includes result.unknown_calls, "title"
  end

  test "operator assignment registers as local" do
    path = write_template("posts/show.html.erb", "<% count += 1 %>\n<%= count %>")

    result = analyzer.analyze(path)

    refute_includes result.unknown_calls, "count"
  end

  test "multiple assignment registers all locals" do
    path = write_template("posts/show.html.erb", "<% a, b = [1, 2] %>\n<%= a %><%= b %>")

    result = analyzer.analyze(path)

    refute_includes result.unknown_calls, "a"
    refute_includes result.unknown_calls, "b"
  end

  test "detects multiple instance variables in ternary" do
    path = write_template("posts/show.html.erb", '<%= @admin ? @post.title : "Hidden" %>')

    result = analyzer.analyze(path)

    assert_includes result.instance_variables, "@admin"
    assert_includes result.instance_variables, "@post"
  end

  test "block parameters are scoped and not treated as template-wide locals" do
    path = write_template("posts/index.html.erb",
                          "<%= user %>\n<% @users.each do |user| %>\n<%= user %>\n<% end %>\n<%= user %>")

    result = analyzer.analyze(path)

    assert_includes result.unknown_calls, "user"
    assert_includes result.instance_variables, "@users"
  end

  test "affected_templates traces state through render graph" do
    entry = write_template("posts/show.html.erb", '<%= @post.title %><%= render "posts/header", post: @post %>')
    write_template("posts/_header.html.erb", "<h1><%= post.name %></h1>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    assert_includes affected, File.join(@view_root, "posts/show.html.erb")
    assert_includes affected, File.join(@view_root, "posts/_header.html.erb")
  end

  test "affected_templates does not include unrelated templates" do
    entry = write_template("posts/show.html.erb", '<%= @post.title %><%= render "posts/header", post: @post %>')
    write_template("posts/_header.html.erb", "<h1><%= post.name %></h1>")
    write_template("pages/about.html.erb", "<h1>About</h1>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    refute_includes affected, File.join(@view_root, "pages/about.html.erb")
  end

  test "affected_templates traces through nested renders" do
    entry = write_template("posts/show.html.erb", '<%= render "posts/header", post: @post %>')
    write_template("posts/_header.html.erb", '<%= render "posts/title", title: post.title %>')
    write_template("posts/_title.html.erb", "<h1><%= title %></h1>")

    a = analyzer
    affected = a.affected_templates(entry, "@post")

    assert_includes affected, File.join(@view_root, "posts/show.html.erb")
    assert_includes affected, File.join(@view_root, "posts/_header.html.erb")
    assert_includes affected, File.join(@view_root, "posts/_title.html.erb")
  end

  test "affected_templates handles constants" do
    entry = write_template("posts/index.html.erb", "<%= Post.count %>")

    a = analyzer
    affected = a.affected_templates(entry, "Post.count")

    assert_includes affected, File.join(@view_root, "posts/index.html.erb")
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

  test "affected_nodes follows state through a block parameter" do
    path = write_template("posts/index.html.erb", "<ul><% @items.each do |item| %><li><%= item.name %></li><% end %></ul>")

    nodes = analyzer.affected_nodes(path, "@items")
    expressions = nodes.map { |node| node[:expression] }

    assert_includes expressions, "item.name"
  end

  test "affected_nodes follows state through every parameter a block binds" do
    path = write_template("posts/index.html.erb", "<ul><% @rows.each_with_index do |row, i| %><li><%= i %>: <%= row.title %></li><% end %></ul>")

    expressions = analyzer.affected_nodes(path, "@rows").map { |node| node[:expression] }

    assert_includes expressions, "i"
    assert_includes expressions, "row.title"
  end

  test "affected_nodes leaves an expression a block parameter does not reach" do
    path = write_template("posts/index.html.erb", "<div><% @items.each do |item| %><%= other %><% end %></div>")

    expressions = analyzer.affected_nodes(path, "@items").map { |node| node[:expression] }

    refute_includes expressions, "other"
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

    assert_includes expressions, "@post.title"
    refute_includes expressions, "@posts.count"
  end

  test "dependency_index marks if-blocks containing state as conditional" do
    path = write_template("posts/show.html.erb", "<div><% if @admin %><%= @post.name %><% end %></div>")

    a = analyzer
    index = a.dependency_index(path)

    assert index.key?("@post")
    types = index["@post"].map { |n| n[:type] }
    assert_includes types, :conditional
    assert_includes types, :text_content

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
