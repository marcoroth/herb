# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/ruby_locals_index"

class RubyLocalsIndexTest < Minitest::Spec
  def index_for(source)
    Herb::Analysis::RubyLocalsIndex.from_source(source)
  end

  def text_at(source, location)
    source.split("\n")[location.start.line - 1][location.start.column...location.end.column]
  end

  def lines_of(local)
    [local.declaration.start.line, *local.usages.map { |usage| usage.start.line }]
  end

  test "reports nothing for a template without locals" do
    assert_empty index_for("<div>hello</div>").locals
  end

  test "pairs a strict local with the places it is read" do
    source = "<%# locals: (title:, count: 0) %>\n\n<h1><%= title %></h1>\n<p><%= count %></p>\n"
    index = index_for(source)

    title = index.find("title")

    assert_equal [1, 3], lines_of(title)
    assert_equal "title", text_at(source, title.declaration)
    usages = title.usages.map { |usage| text_at(source, usage) }

    assert_equal ["title"], usages

    assert_equal [1, 4], lines_of(index.find("count"))
  end

  test "leaves the colon out of a strict local declaration" do
    source = "<%# locals: (title:) %>\n<p><%= title %></p>\n"

    assert_equal "title", text_at(source, index_for(source).find("title").declaration)
  end

  test "reports a strict local that is never read" do
    source = "<%# locals: (unused:) %>\n<p>nothing</p>\n"
    local = index_for(source).find("unused")

    assert_equal "unused", local.name
    assert_empty local.usages
  end

  test "follows a local passed with shorthand hash syntax" do
    source = "<%# locals: (user:, favorite_user:) %>\n\n<%= render \"profiles/header\", user:, favorite_user: %>\n"
    index = index_for(source)

    assert_equal [1, 3], lines_of(index.find("user"))
    assert_equal "user", text_at(source, index.find("user").usages.first)
    assert_equal "favorite_user", text_at(source, index.find("favorite_user").usages.first)
  end

  test "pairs a block parameter with the places it is read" do
    source = "<% posts.each do |post| %>\n  <%= post.title %>\n<% end %>\n"
    local = index_for(source).find("post")

    assert_equal [1, 2], lines_of(local)
    assert_equal "post", text_at(source, local.declaration)
  end

  test "keeps two blocks taking the same parameter name apart" do
    source = "<% posts.each do |post| %>\n  <%= post.title %>\n<% end %>\n<% drafts.each do |post| %>\n  <%= post.body %>\n<% end %>\n"
    index = index_for(source)

    lines = index.locals.map { |local| lines_of(local) }

    assert_equal [[1, 2], [4, 5]], lines
  end

  test "keeps a block parameter that shadows a strict local separate" do
    source = "<%# locals: (user:) %>\n<% users.each do |user| %>\n  <%= user %>\n<% end %>\n<%= render \"x\", user: %>\n"
    index = index_for(source)

    lines = index.locals.map { |local| lines_of(local) }

    assert_equal [[1, 5], [2, 3]], lines
  end

  test "answers with the innermost binding for a shadowed position" do
    source = "<%# locals: (user:) %>\n<% users.each do |user| %>\n  <%= user %>\n<% end %>\n<%= render \"x\", user: %>\n"
    index = index_for(source)

    assert_equal 2, index.at(3, 8).declaration.start.line
    assert_equal 1, index.at(1, 15).declaration.start.line
    assert_equal 1, index.at(5, 18).declaration.start.line
  end

  test "returns nothing for a position that is not on a local" do
    source = "<%# locals: (title:) %>\n<p><%= title %></p>\n"

    assert_nil index_for(source).at(2, 1)
  end

  test "reports assignment names separately from block parameters" do
    source = "<% total = 0 %>\n<% posts.each do |post| %>\n  <% total += 1 %>\n<% end %>\n"
    index = index_for(source)

    assert_equal ["total"], index.assignment_names.to_a.sort
    assert_equal ["post", "total"], index.names.to_a.sort
  end

  test "counts columns in bytes so multibyte content does not shift a location" do
    source = "<%# locals: (title:) %>\n<p>über</p>\n<p><%= title %></p>\n"
    local = index_for(source).find("title")

    assert_equal 3, local.usages.first.start.line
    assert_equal "title", text_at(source, local.declaration)
  end
  test "declares herb:state names, so a state read is not an unknown name" do
    source = "<%# herb:state (pending: false, attempts: 0) %>\n<p><%= attempts %></p>\n<% if pending? %><b>x</b><% end %>\n"
    index = index_for(source)

    assert_equal ["attempts", "pending"], index.names.to_a.sort
    assert_equal 1, index.locals.find { |local| local.name == "attempts" }.usages.size
    assert_equal 1, index.locals.find { |local| local.name == "pending" }.usages.size
  end

  test "a state seeded from a strict local indexes both names" do
    source = "<%# locals: (open_initially: false) %>\n<%# herb:state (open: open_initially) %>\n<div><% if open %>a<% end %></div>\n"
    index = index_for(source)

    assert_equal ["open", "open_initially"], index.names.to_a.sort
  end
end
