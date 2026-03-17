# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../snapshot_utils"
require_relative "../../lib/herb/engine"

require "tmpdir"
require "fileutils"

module Engine
  class RenderNodesTest < Minitest::Spec
    include SnapshotUtils

    def setup
      @project_path = Dir.mktmpdir("herb_render_test")
      @view_root = File.join(@project_path, "app", "views")
      FileUtils.mkdir_p(File.join(@view_root, "posts"))
      FileUtils.mkdir_p(File.join(@view_root, "shared"))

      File.write(File.join(@view_root, "shared", "_header.html.erb"), "<header>Header</header>")
      File.write(File.join(@view_root, "shared", "_footer.html.erb"), "<footer>Footer</footer>")
      File.write(File.join(@view_root, "posts", "_card.html.erb"), "<div>Card</div>")
    end

    def teardown
      FileUtils.rm_rf(@project_path)
    end

    def compile(template, **options)
      Herb::Engine.new(
        template,
        filename: "app/views/posts/show.html.erb",
        project_path: @project_path,
        framework: :action_view,
        **options
      )
    end

    def render_diagnostics(template, **_options)
      result = Herb.parse(template, render_nodes: true)

      validator = Herb::Engine::Validators::RenderValidator.new(
        enabled: true,
        filename: Pathname.new("app/views/posts/show.html.erb"),
        project_path: Pathname.new(@project_path)
      )

      result.value.accept(validator)

      validator.diagnostics
    end

    test "no diagnostics for existing partial" do
      diagnostics = render_diagnostics('<%= render "shared/header" %>')

      assert_empty diagnostics
    end

    test "no diagnostics for existing relative partial" do
      diagnostics = render_diagnostics('<%= render "card" %>')

      assert_empty diagnostics
    end

    test "warns when partial cannot be resolved" do
      diagnostics = render_diagnostics('<%= render "nonexistent/missing" %>')

      assert_equal 1, diagnostics.length
      assert_equal :error, diagnostics.first[:severity]
      assert_includes diagnostics.first[:message], "Partial 'nonexistent/missing' could not be resolved"
      assert_equal "RenderUnresolved", diagnostics.first[:code]
    end

    test "warns for dynamic render calls" do
      diagnostics = render_diagnostics("<%= render @product %>")

      assert_equal 1, diagnostics.length
      assert_equal :warning, diagnostics.first[:severity]
      assert_includes diagnostics.first[:message], "Dynamic render call cannot be statically resolved"
      assert_equal "RenderDynamic", diagnostics.first[:code]
    end

    test "no diagnostics for keyword partial that exists" do
      diagnostics = render_diagnostics('<%= render partial: "shared/header" %>')

      assert_empty diagnostics
    end

    test "warns for keyword partial that does not exist" do
      diagnostics = render_diagnostics('<%= render partial: "missing/partial" %>')

      assert_equal 1, diagnostics.length
      assert_includes diagnostics.first[:message], "Partial 'missing/partial' could not be resolved"
    end

    test "validator is disabled without action_view framework" do
      engine = Herb::Engine.new(
        '<%= render "nonexistent" %>',
        filename: "app/views/posts/show.html.erb",
        project_path: @project_path
      )

      refute_nil engine.src
    end

    test "no validation when filename is not provided" do
      result = Herb.parse('<%= render "nonexistent" %>', render_nodes: true)

      validator = Herb::Engine::Validators::RenderValidator.new(
        enabled: true,
        filename: nil,
        project_path: Pathname.new(@project_path)
      )

      result.value.accept(validator)

      assert_empty validator.diagnostics
    end

    test "compiled output is identical with or without framework" do
      template = '<%= render "shared/header" %>'

      without = Herb::Engine.new(template)
      with = compile(template)

      assert_equal without.src, with.src
    end
  end
end
