# frozen_string_literal: true

require "tmpdir"
require "fileutils"

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/partial_resolver"

module Analysis
  class PartialResolverTest < Minitest::Spec
    PartialResolver = Herb::Analysis::PartialResolver

    def with_project
      Dir.mktmpdir("herb-resolver") do |root|
        @root = Pathname.new(root)

        write("app/views/shared/_card.html.erb")
        write("app/views/shared/_card.turbo_stream.erb")
        write("app/views/users/_row.html.erb")
        write("app/views/users/row.html.erb")
        write("app/views/_footer.html.erb")

        yield PartialResolver.new(root)
      end
    end

    def write(relative)
      path = @root.join(relative)

      FileUtils.mkdir_p(path.dirname)
      File.write(path, "<p>#{relative}</p>")
    end

    test "a name with a directory resolves under the view root" do
      with_project do |resolver|
        resolved = resolver.resolve("shared/card")

        assert_equal @root.join("app/views/shared/_card.html.erb"), resolved.path
        assert_equal "app/views/shared/_card.html.erb", resolved.identifier
      end
    end

    test "a bare name resolves next to the calling template first" do
      with_project do |resolver|
        assert_equal "app/views/users/_row.html.erb", resolver.resolve("row", from: "app/views/users/show.html.erb").identifier
        assert_equal "app/views/_footer.html.erb", resolver.resolve("footer", from: "app/views/users/show.html.erb").identifier
        assert_nil resolver.resolve("row")
      end
    end

    test "an absolute caller path works the same as a relative one" do
      with_project do |resolver|
        from = @root.join("app/views/users/show.html.erb")

        assert_equal "app/views/users/_row.html.erb", resolver.resolve("row", from: from).identifier
      end
    end

    test "a format prefers the matching extension and falls back" do
      with_project do |resolver|
        assert_equal "app/views/shared/_card.turbo_stream.erb", resolver.resolve("shared/card", format: "turbo_stream").identifier
        assert_equal "app/views/shared/_card.html.erb", resolver.resolve("shared/card", format: "json").identifier
        assert_equal "app/views/shared/_card.html.erb", resolver.resolve("shared/card").identifier
      end
    end

    test "a missing partial answers nil and lists where it looked" do
      with_project do |resolver|
        assert_nil resolver.resolve("shared/missing")

        searched = resolver.candidates("missing", from: "app/views/users/show.html.erb").map { |path| resolver.identifier_for(path) }

        assert_equal "app/views/users/_missing.html.erb", searched.first
        assert_equal "app/views/_missing.html.erb", searched.fetch(1)
        assert_equal Herb::Analysis::PartialResolution::EXTENSIONS.size * 2, searched.size
      end
    end

    test "a near miss suggests the partial it resembles" do
      with_project do |resolver|
        assert_equal ["shared/card"], resolver.similar("shared/cart")
      end
    end

    test "a template that is not a partial is pointed out" do
      with_project do |resolver|
        assert_equal ["users/row.html.erb exists as a template, not a partial. Rename to _row.html.erb to use it with render"], resolver.similar("users/row")
      end
    end

    test "a file outside the project gets the identifier its own compile would report" do
      with_project do |resolver|
        Dir.mktmpdir("herb-engine") do |elsewhere|
          path = Pathname.new(elsewhere).join("_widget.html.erb")
          own = Herb::Visitor::Context.new(file_path: path, project_path: @root).relative_file_path

          assert_equal own, resolver.identifier_for(path)
          assert_match(%r{\A\.\./}, own)
        end
      end
    end

    test "a project without a views directory resolves from its root" do
      Dir.mktmpdir("herb-flat") do |root|
        FileUtils.mkdir_p(File.join(root, "shared"))
        File.write(File.join(root, "shared", "_card.html.erb"), "")

        resolver = PartialResolver.new(root)

        assert_equal Pathname.new(root), resolver.view_root
        assert_equal "shared/_card.html.erb", resolver.resolve("shared/card").identifier
      end
    end

    test "a resolver without a view root only looks next to the caller" do
      with_project do |_|
        resolver = PartialResolver.new(@root, view_root: false)

        assert_nil resolver.resolve("shared/card")
        assert_equal "app/views/users/_row.html.erb", resolver.resolve("row", from: "app/views/users/show.html.erb").identifier
      end
    end
  end
end
