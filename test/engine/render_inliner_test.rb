# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

module Engine
  class RenderInlinerTest < Minitest::Spec
    include SnapshotUtils

    PROJECT_PATH = "test/fixtures/render_inliner"

    test "inlines a simple partial" do
      assert_compiled_snapshot('<%= render "shared/header" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "inlines partial with locals" do
      assert_compiled_snapshot('<%= render partial: "posts/card", locals: { title: @post.title } %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "does not inline dynamic render" do
      assert_compiled_snapshot("<%= render @product %>", filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "does not inline when optimize is false" do
      assert_compiled_snapshot('<%= render "shared/header" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: false, escape: false)
    end

    test "does not inline partial with yield" do
      assert_compiled_snapshot('<%= render "shared/wrapper" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "does not inline partial with content_for" do
      assert_compiled_snapshot('<%= render "shared/sidebar" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "does not inline partial with local_assigns" do
      assert_compiled_snapshot('<%= render "shared/item" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "inlines collection renders" do
      assert_compiled_snapshot('<%= render partial: "posts/post", collection: @posts %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "inlines collection with as: option" do
      assert_compiled_snapshot('<%= render partial: "posts/post", collection: @posts, as: :item %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "does not inline collection with spacer_template" do
      assert_compiled_snapshot('<%= render partial: "posts/post", collection: @posts, spacer_template: "posts/spacer" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "inlines nested partials" do
      assert_compiled_snapshot('<%= render "shared/outer" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "detects circular references and falls back" do
      assert_compiled_snapshot('<%= render "shared/a" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "scopes locals with begin/end block" do
      assert_compiled_snapshot('<%= render partial: "posts/card", locals: { name: "test" } %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "falls back for unresolvable partial" do
      assert_compiled_snapshot('<%= render "nonexistent/missing" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "handles Ruby 3.1 shorthand hash locals" do
      assert_compiled_snapshot('<%= render partial: "posts/card", locals: { title: } %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "inlines shorthand render with inline locals" do
      assert_compiled_snapshot('<%= render "posts/card", title: "Title" %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end

    test "inlines shorthand render with multiple inline locals" do
      assert_compiled_snapshot('<%= render "posts/card", title: "Title", name: @user.name %>', filename: "app/views/posts/index.html.erb", project_path: PROJECT_PATH, optimize: true, inline_render: true, escape: false)
    end
  end
end
