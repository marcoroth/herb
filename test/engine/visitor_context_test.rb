# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/engine"

module Engine
  class VisitorContextTest < Minitest::Spec
    def context(**)
      Herb::Engine::VisitorContext.new(**)
    end

    test "a relative file path is kept as given" do
      assert_equal "app/views/users/show.html.erb",
                   context(file_path: "app/views/users/show.html.erb", project_path: "/proj").relative_file_path
    end

    test "a dot slash prefix is normalized away" do
      assert_equal "app/x.erb", context(file_path: "./app/x.erb", project_path: "/proj").relative_file_path
    end

    test "parent directory segments are resolved" do
      assert_equal "x.erb", context(file_path: "app/../x.erb", project_path: "/proj").relative_file_path
    end

    test "an empty file path has no path at all" do
      subject = context(file_path: "", project_path: "/proj")

      assert_nil subject.file_path
      assert_equal "unknown", subject.relative_file_path
    end

    test "a missing file path has no path at all" do
      subject = context(project_path: "/proj")

      assert_nil subject.file_path
      assert_equal "unknown", subject.relative_file_path
    end

    test "an absolute file path is made relative to the project" do
      assert_equal "app/x.erb", context(file_path: "/proj/app/x.erb", project_path: "/proj").relative_file_path
    end

    test "an absolute file path with a relative project path falls back instead of raising" do
      assert_equal "/abs/x.erb", context(file_path: "/abs/x.erb", project_path: "relative").relative_file_path
    end

    test "the file path is not absolutized" do
      assert_equal "test.erb", context(file_path: "test.erb").file_path.to_s
    end

    test "a Pathname file path is accepted" do
      assert_equal "test.erb", context(file_path: Pathname.new("test.erb")).file_path.to_s
    end

    test "the project path defaults to the working directory" do
      assert_equal Dir.pwd, context.project_path.to_s
    end

    test "a Pathname project path is accepted" do
      assert_equal "/proj", context(project_path: Pathname.new("/proj")).project_path.to_s
    end

    test "the context is frozen" do
      assert_predicate context(file_path: "x.erb"), :frozen?
    end

    test "arbitrary data is readable through the bag" do
      subject = context(file_path: "x.erb", theme: "dark", level: 2)

      assert_equal "dark", subject[:theme]
      assert_equal 2, subject[:level]
      assert_equal({ theme: "dark", level: 2 }, subject.data)
    end

    test "well known keys are readable through the bag" do
      subject = context(file_path: "app/x.erb", project_path: "/proj")

      assert_equal "app/x.erb", subject[:relative_file_path]
      assert_equal "/proj", subject[:project_path].to_s
    end

    test "an unknown key reads as nil" do
      assert_nil context[:nope]
    end

    test "key? covers well known keys and arbitrary data" do
      subject = context(theme: "dark")

      assert subject.key?(:file_path)
      assert subject.key?(:theme)
      refute subject.key?(:nope)
    end

    test "fetch returns a default for a missing key" do
      assert_equal "fallback", context.fetch(:nope, "fallback")
    end

    test "fetch raises for a missing key without a default" do
      assert_raises(KeyError) { context.fetch(:nope) }
    end

    test "engine options are exposed" do
      assert_equal true, context(options: { escape: true })[:options][:escape]
    end

    test "merge recomputes the relative file path" do
      merged = context(file_path: "a.erb", project_path: "/proj").merge(file_path: "./b/c.erb")

      assert_equal "b/c.erb", merged.relative_file_path
      assert_equal "./b/c.erb", merged.file_path.to_s
    end

    test "merge keeps arbitrary data and adds to it" do
      merged = context(theme: "dark").merge(level: 2)

      assert_equal "dark", merged[:theme]
      assert_equal 2, merged[:level]
    end

    test "merge does not mutate the original" do
      subject = context(file_path: "a.erb")
      subject.merge(file_path: "b.erb")

      assert_equal "a.erb", subject.file_path.to_s
    end

    test "inspect omits the project path so it stays machine independent" do
      subject = context(file_path: "app/x.erb", project_path: "/proj")

      assert_equal %(#<Herb::Engine::VisitorContext file_path="app/x.erb" relative_file_path="app/x.erb">), subject.inspect
      refute_includes subject.inspect, "/proj"
    end

    test "to_hash exposes every part" do
      assert_equal [:file_path, :project_path, :relative_file_path, :options, :data], context.to_hash.keys
    end
  end
end
