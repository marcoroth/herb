# frozen_string_literal: true

require_relative "test_helper"

class PartialResolutionTest < Minitest::Spec
  Subject = Herb::PartialResolution

  test "derives the partial glob from the extension list" do
    assert_equal "_#{Subject::TEMPLATE_GLOB_PATTERN}", Subject::PARTIAL_GLOB_PATTERN
  end

  test "covers every extension in the template glob" do
    Subject::EXTENSIONS.each do |extension|
      assert_includes Subject::TEMPLATE_GLOB_PATTERN, extension.delete_prefix(".")
    end
  end

  test "recognises a template path" do
    assert Subject.template_path?("app/views/posts/index.html.erb")
    assert Subject.template_path?("app/views/posts/index.herb")
    refute Subject.template_path?("app/views/posts/README.md")
  end

  test "recognises a partial path" do
    assert Subject.partial_path?("app/views/posts/_card.html.erb")
    refute Subject.partial_path?("app/views/posts/index.html.erb")
    refute Subject.partial_path?("app/views/posts/_card.md")
  end

  test "names a partial relative to the view root" do
    assert_equal "posts/card", Subject.partial_name_for("app/views/posts/_card.html.erb", "app/views")
  end

  test "names a partial sitting at the view root" do
    assert_equal "banner", Subject.partial_name_for("app/views/_banner.html.erb", "app/views")
  end

  test "keeps a dot in a directory name out of the partial name" do
    assert_equal "posts.v2/card", Subject.partial_name_for("app/views/posts.v2/_card.html.erb", "app/views")
  end

  test "ranks each known extension by its position in the list" do
    Subject::EXTENSIONS.each_with_index do |extension, index|
      assert_equal index, Subject.template_rank("_card#{extension}")
    end
  end

  test "ranks an unknown extension last" do
    assert_equal Subject::EXTENSIONS.size, Subject.template_rank("_card.md")
    assert_equal Subject::EXTENSIONS.size, Subject.template_rank("_card")
  end

  test "prefers the html erb variant over a bare erb variant" do
    assert Subject.outranks_template?("_card.html.erb", "_card.erb")
    refute Subject.outranks_template?("_card.erb", "_card.html.erb")
  end

  test "breaks a rank tie alphabetically" do
    assert Subject.outranks_template?("admin/_card.html.erb", "posts/_card.html.erb")
  end

  test "orders variants by precedence" do
    files = ["_card.turbo_stream.erb", "_card.erb", "_card.html.erb", "_card.herb"]

    assert_equal ["_card.html.erb", "_card.erb", "_card.herb", "_card.turbo_stream.erb"], Subject.by_precedence(files)
  end

  test "does not name a file that sits outside the view root" do
    assert_nil Subject.partial_name_for("other/place/_card.html.erb", "app/views")
  end

  test "does not name a partial whose name is only an extension" do
    assert_nil Subject.partial_name_for("app/views/_.html.erb", "app/views")
  end

  test "does not name the view root itself" do
    assert_nil Subject.partial_name_for("app/views", "app/views")
  end

  test "does not name a file that is not a partial" do
    assert_nil Subject.partial_name_for("app/views/posts/index.html.erb", "app/views")
  end
end
