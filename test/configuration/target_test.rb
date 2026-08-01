# frozen_string_literal: true

require_relative "../test_helper"

class ConfigurationTargetTest < Minitest::Spec
  Target = Herb::Configuration::Target

  describe "toggle_path" do
    test "maps a tool to its enabled key" do
      assert_equal "linter.enabled", Target.toggle_path("linter")
      assert_equal "formatter.enabled", Target.toggle_path("formatter")
    end

    test "passes a dotted path through untouched" do
      assert_equal "engine.validators.security", Target.toggle_path("engine.validators.security")
    end

    test "treats a bare name as a linter rule" do
      assert_equal "linter.rules.html-img-require-alt.enabled", Target.toggle_path("html-img-require-alt")
    end

    test "refuses a rewriter, which needs a position rather than a boolean" do
      assert_raises(Target::UnknownTargetError) { Target.toggle_path("tailwind-class-sorter") }
    end
  end

  describe "rewriter_path" do
    test "resolves built-in rewriters to their position" do
      assert Target.rewriter?("tailwind-class-sorter")
      assert_equal "formatter.rewriter.pre", Target.rewriter_path("tailwind-class-sorter")
    end

    test "does not claim unknown names" do
      refute Target.rewriter?("html-img-require-alt")
    end
  end

  describe "pattern_path" do
    test "defaults to the top-level files section" do
      assert_equal "files.exclude", Target.pattern_path("exclude")
    end

    test "scopes to a tool" do
      assert_equal "linter.exclude", Target.pattern_path("exclude", tool: "linter")
      assert_equal "formatter.include", Target.pattern_path("include", tool: "formatter")
    end

    test "scopes to a rule, which wins over the tool" do
      assert_equal "linter.rules.some-rule.exclude", Target.pattern_path("exclude", tool: "linter", rule: "some-rule")
    end

    test "rejects an unknown tool" do
      assert_raises(Target::UnknownTargetError) { Target.pattern_path("exclude", tool: "highlighter") }
    end
  end

  describe "normalize_pattern" do
    def setup
      @temp_dir = Dir.mktmpdir("herb_target_test")
      FileUtils.mkdir_p(File.join(@temp_dir, "app/views/admin"))
    end

    def teardown
      FileUtils.rm_rf(@temp_dir)
    end

    test "expands a directory into a recursive glob" do
      assert_equal "app/views/admin/**/*", Target.normalize_pattern("app/views/admin", root: @temp_dir)
    end

    test "ignores a trailing slash" do
      assert_equal "app/views/admin/**/*", Target.normalize_pattern("app/views/admin/", root: @temp_dir)
    end

    test "leaves an existing glob alone" do
      assert_equal "app/**/*.html.erb", Target.normalize_pattern("app/**/*.html.erb", root: @temp_dir)
    end

    test "leaves a plain file path alone" do
      assert_equal "app/views/admin/index.html.erb",
                   Target.normalize_pattern("app/views/admin/index.html.erb", root: @temp_dir)
    end
  end
end
