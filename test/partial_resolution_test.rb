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

  test "does not name a file that is not a partial" do
    assert_nil Subject.partial_name_for("app/views/posts/index.html.erb", "app/views")
  end
end
