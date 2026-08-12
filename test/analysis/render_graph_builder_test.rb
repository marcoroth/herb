# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/partial_index"
require_relative "../../lib/herb/analysis/render_graph/builder"

require "tmpdir"
require "fileutils"

class RenderGraphBuilderTest < Minitest::Spec
  def setup
    @project_path = Dir.mktmpdir("herb_render_graph_builder_test")
    @view_root = File.join(@project_path, "app", "views", "posts")
    FileUtils.mkdir_p(@view_root)
  end

  def teardown
    FileUtils.rm_rf(@project_path)
  end

  def write(name, content)
    path = File.join(@view_root, name)
    File.write(path, content)
    path
  end

  def builder
    Herb::Analysis::RenderGraph::Builder.new(Herb::Analysis::PartialIndex.build(@project_path))
  end

  def collect(file, source)
    sites = {}
    collected = builder.collect_call_sites(file, source, sites)

    [sites, collected]
  end

  test "records the ancestors a partial is rendered under" do
    write("_row.html.erb", "<tr></tr>")
    entry = write("index.html.erb", '<table><tbody><%= render "posts/row" %></tbody></table>')

    sites, = collect(entry, File.read(entry))

    assert_equal ["table", "tbody"], sites.values.flatten.first.ancestors
  end

  test "records the locals a call site passes" do
    write("_row.html.erb", "<tr></tr>")
    entry = write("index.html.erb", '<%= render "posts/row", post: post, index: index %>')

    sites, = collect(entry, File.read(entry))

    assert_equal ["post", "index"], sites.values.flatten.first.locals
  end

  test "captures a static class attribute from an ancestor" do
    write("_row.html.erb", "<tr></tr>")
    entry = write("index.html.erb", '<table class="grid"><%= render "posts/row" %></table>')

    sites, = collect(entry, File.read(entry))

    assert_equal [{ "class" => "grid" }], sites.values.flatten.first.ancestor_attributes
  end

  test "counts a render it cannot resolve to a partial" do
    entry = write("index.html.erb", '<%= render "posts/missing" %>')

    sites, collected = collect(entry, File.read(entry))

    assert_empty sites
    assert_equal 1, collected.unresolved
  end

  test "counts a dynamic render as unresolved" do
    entry = write("index.html.erb", "<%= render @post %>")

    _, collected = collect(entry, File.read(entry))

    assert_equal 1, collected.unresolved
  end

  test "marks a template containing html as a document root" do
    entry = write("index.html.erb", '<html><body><%= render "posts/row" %></body></html>')

    _, collected = collect(entry, File.read(entry))

    assert collected.document_root
  end

  test "does not mark a partial as a document root" do
    entry = write("_row.html.erb", '<tr><%= render "posts/cell" %></tr>')

    _, collected = collect(entry, File.read(entry))

    refute collected.document_root
  end

  test "records the root tags a template renders" do
    entry = write("_row.html.erb", "<tr></tr><td></td>")

    _, collected = collect(entry, File.read(entry))

    assert_equal ["tr", "td"], collected.roots.tags
  end

  test "separates root tags that sit behind a conditional" do
    entry = write("_row.html.erb", "<tr></tr><% if admin? %><td></td><% end %>")

    _, collected = collect(entry, File.read(entry))

    assert_equal ["tr"], collected.roots.tags
    assert_equal ["td"], collected.roots.conditional_tags
  end

  test "skips a template that renders nothing" do
    entry = write("index.html.erb", "<div>static</div>")

    sites, collected = collect(entry, File.read(entry))

    assert_empty sites
    assert_equal 0, collected.unresolved
  end

  test "builds a graph over every template" do
    write("_row.html.erb", "<tr></tr>")
    write("index.html.erb", '<html><table><%= render "posts/row" %></table></html>')

    index = Herb::Analysis::PartialIndex.build(@project_path)
    graph = Herb::Analysis::RenderGraph::Builder.new(index).build(index.templates)

    assert_equal 1, graph.size
    assert_equal :always, graph.context_of(File.join(@view_root, "_row.html.erb")).ancestor_verdict([], "table")
  end

  test "records a template it could not read as skipped" do
    index = Herb::Analysis::PartialIndex.build(@project_path)
    graph = Herb::Analysis::RenderGraph::Builder.new(index).build([File.join(@view_root, "missing.html.erb")])

    assert_equal 1, graph.skipped_file_count
    refute graph.complete?
  end
end
