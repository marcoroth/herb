# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/render_graph"

class RenderGraphTest < Minitest::Spec
  def call_site(caller, ancestors: [], locals: [], attributes: nil)
    Herb::Analysis::RenderGraph::PartialCallSite.new(
      caller: caller,
      locals: locals,
      ancestors: ancestors,
      ancestor_attributes: attributes,
      via: "render",
      location: nil
    )
  end

  def graph_with(call_sites, document_roots: [], unresolved: {}, roots: {})
    Herb::Analysis::RenderGraph.new(call_sites, roots, Set.new(document_roots), unresolved, Set.new)
  end

  test "reports unknown for a partial nothing renders" do
    graph = graph_with({})

    assert_equal :unknown, graph.context_of("_row.html.erb").ancestor_verdict([], "table")
  end

  test "reports always when every call site is inside the tag" do
    graph = graph_with(
      { "_row.html.erb" => [call_site("index.html.erb", ancestors: ["table", "tbody"])] },
      document_roots: ["index.html.erb"]
    )

    assert_equal :always, graph.context_of("_row.html.erb").ancestor_verdict([], "table")
  end

  test "reports mixed when only some call sites are inside the tag" do
    graph = graph_with(
      {
        "_row.html.erb" => [
          call_site("index.html.erb", ancestors: ["table"]),
          call_site("show.html.erb", ancestors: ["div"])
        ],
      },
      document_roots: ["index.html.erb", "show.html.erb"]
    )

    assert_equal :mixed, graph.context_of("_row.html.erb").ancestor_verdict([], "table")
  end

  test "reports never when no call site is inside the tag" do
    graph = graph_with(
      { "_row.html.erb" => [call_site("show.html.erb", ancestors: ["div"])] },
      document_roots: ["show.html.erb"]
    )

    assert_equal :never, graph.context_of("_row.html.erb").ancestor_verdict([], "table")
  end

  test "reports unknown instead of never when the graph is incomplete" do
    graph = graph_with(
      { "_row.html.erb" => [call_site("index.html.erb", ancestors: ["div"])] },
      unresolved: { "index.html.erb" => 1 }
    )

    assert_equal :unknown, graph.context_of("_row.html.erb").ancestor_verdict([], "table")
  end

  test "reports always from a local ancestor without consulting the graph" do
    graph = graph_with({})

    assert_equal :always, graph.context_of("_row.html.erb").ancestor_verdict(["table"], "table")
  end

  test "carries ancestors across two render levels" do
    graph = graph_with(
      {
        "_cell.html.erb" => [call_site("_row.html.erb", ancestors: ["tr"])],
        "_row.html.erb" => [call_site("index.html.erb", ancestors: ["table", "tbody"])],
      },
      document_roots: ["index.html.erb"]
    )

    context = graph.context_of("_cell.html.erb")

    assert_equal [["table", "tbody", "tr"]], context.chains.map(&:tags)
    assert_equal :always, context.ancestor_verdict([], "table")
  end

  test "does not loop forever on a render cycle" do
    graph = graph_with(
      {
        "a.html.erb" => [call_site("b.html.erb", ancestors: ["div"])],
        "b.html.erb" => [call_site("a.html.erb", ancestors: ["span"])],
      }
    )

    refute graph.context_of("a.html.erb").resolved
  end

  test "finds the innermost matching ancestor" do
    graph = graph_with(
      { "_cell.html.erb" => [call_site("index.html.erb", ancestors: ["table", "tbody", "tr"])] },
      document_roots: ["index.html.erb"]
    )

    assert_equal "tr", graph.context_of("_cell.html.erb").closest_ancestor([], "tr", "table")
  end

  test "infers a signature from the locals each call site passes" do
    graph = graph_with(
      {
        "_card.html.erb" => [
          call_site("a.html.erb", locals: ["title", "body"]),
          call_site("b.html.erb", locals: ["title", "footer"])
        ],
      },
      document_roots: ["a.html.erb", "b.html.erb"]
    )

    signature = graph.infer_signature("_card.html.erb")

    assert_equal ["body", "footer", "title"], signature.locals.map(&:name)
    assert_equal 2, signature.call_site_count
    assert_equal "<%# locals: (body: nil, footer: nil, title: nil) %>", signature.strict_locals_declaration
  end

  test "adds a keyword rest to the signature when the graph is incomplete" do
    graph = graph_with(
      { "_card.html.erb" => [call_site("a.html.erb", locals: ["title"])] },
      unresolved: { "a.html.erb" => 1 }
    )

    assert_equal "<%# locals: (title: nil, **) %>", graph.infer_signature("_card.html.erb").strict_locals_declaration
  end

  test "counts occurrences of a repeated chain" do
    graph = graph_with(
      {
        "_cell.html.erb" => [call_site("_row.html.erb", ancestors: ["tr"])],
        "_row.html.erb" => [
          call_site("index.html.erb", ancestors: ["table"]),
          call_site("archive.html.erb", ancestors: ["table"])
        ],
      },
      document_roots: ["index.html.erb", "archive.html.erb"]
    )

    context = graph.context_of("_cell.html.erb")

    assert_equal 1, context.chains.size
    assert_equal 2, context.chains.first.occurrences
  end

  test "reports always for a descendant tag in the partial's own roots" do
    roots = { "_row.html.erb" => Herb::Analysis::RenderGraph::TemplateRoots.new(tags: ["td"], conditional_tags: [], renders: [], resolved: true) }
    graph = graph_with({}, roots: roots)

    assert_equal :always, graph.descendant_verdict(["_row.html.erb"], "td")
  end

  test "reports mixed for a descendant tag behind a conditional" do
    roots = { "_row.html.erb" => Herb::Analysis::RenderGraph::TemplateRoots.new(tags: [], conditional_tags: ["td"], renders: [], resolved: true) }
    graph = graph_with({}, roots: roots)

    assert_equal :mixed, graph.descendant_verdict(["_row.html.erb"], "td")
  end

  test "follows renders when deciding a descendant verdict" do
    roots = {
      "_row.html.erb" => Herb::Analysis::RenderGraph::TemplateRoots.new(tags: [], conditional_tags: [], renders: ["_cell.html.erb"], resolved: true),
      "_cell.html.erb" => Herb::Analysis::RenderGraph::TemplateRoots.new(tags: ["td"], conditional_tags: [], renders: [], resolved: true),
    }
    graph = graph_with({}, roots: roots)

    assert_equal :always, graph.descendant_verdict(["_row.html.erb"], "td")
  end

  test "round trips through a serialized form" do
    graph = graph_with(
      { "_row.html.erb" => [call_site("index.html.erb", ancestors: ["table"], locals: ["post"])] },
      document_roots: ["index.html.erb"]
    )

    restored = Herb::Analysis::RenderGraph.from(graph.to_h)

    assert_equal graph.to_h, restored.to_h
    assert_equal :always, restored.context_of("_row.html.erb").ancestor_verdict([], "table")
  end
end
