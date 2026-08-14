# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/partial_index"

require "tmpdir"

module Analysis
  class FormatsTest < Minitest::Spec
    def write(root, relative)
      path = File.join(root, relative)

      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, "<div></div>\n")

      path
    end

    test "reads the format out of a filename" do
      assert_equal "html", Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.html.erb")
      assert_equal "turbo_stream", Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.turbo_stream.erb")
      assert_equal "html", Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.html.herb")
      assert_nil Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.erb")
      assert_nil Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.herb")
    end

    test "reads the variant out of a filename" do
      assert_equal "mobile", Herb::Analysis::PartialResolution.variant_of("app/views/posts/_row.html+mobile.erb")
      assert_equal "tablet", Herb::Analysis::PartialResolution.variant_of("app/views/posts/_row.html+tablet.herb")
      assert_nil Herb::Analysis::PartialResolution.variant_of("app/views/posts/_row.html.erb")
      assert_nil Herb::Analysis::PartialResolution.variant_of("app/views/posts/_row.erb")
    end

    test "a variant keeps the format of its base template" do
      assert_equal "html", Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.html+mobile.erb")
      assert_equal "turbo_stream", Herb::Analysis::PartialResolution.format_of("app/views/posts/_row.turbo_stream+mobile.erb")
    end

    test "the plain template is preferred over a variant" do
      Dir.mktmpdir do |dir|
        views = File.join(dir, "app", "views")

        caller_file = write(views, "posts/index.html.erb")
        variant = write(views, "posts/_row.html+mobile.erb")
        plain = write(views, "posts/_row.html.erb")

        index = Herb::Analysis::PartialIndex.new([views], [caller_file, variant, plain])
        resolved = index.resolve("posts/row", caller_file)

        assert_equal plain, resolved.first
        assert_includes resolved, variant
      end
    end

    test "a caller reaches the partial matching its own format" do
      Dir.mktmpdir do |dir|
        views = File.join(dir, "app", "views")

        html_caller = write(views, "posts/index.html.erb")
        turbo_caller = write(views, "posts/index.turbo_stream.erb")
        html_partial = write(views, "posts/_row.html.erb")
        turbo_partial = write(views, "posts/_row.turbo_stream.erb")

        index = Herb::Analysis::PartialIndex.new([views], [html_caller, turbo_caller, html_partial, turbo_partial])

        assert_equal html_partial, index.resolve("posts/row", html_caller).first
        assert_equal turbo_partial, index.resolve("posts/row", turbo_caller).first
      end
    end

    test "a formatless partial serves any caller" do
      Dir.mktmpdir do |dir|
        views = File.join(dir, "app", "views")

        turbo_caller = write(views, "posts/index.turbo_stream.erb")
        partial = write(views, "posts/_row.erb")

        index = Herb::Analysis::PartialIndex.new([views], [turbo_caller, partial])

        assert_equal partial, index.resolve("posts/row", turbo_caller).first
      end
    end

    test "a formatless partial loses to an exact format match" do
      Dir.mktmpdir do |dir|
        views = File.join(dir, "app", "views")

        turbo_caller = write(views, "posts/index.turbo_stream.erb")
        formatless = write(views, "posts/_row.erb")
        turbo_partial = write(views, "posts/_row.turbo_stream.erb")

        index = Herb::Analysis::PartialIndex.new([views], [turbo_caller, formatless, turbo_partial])

        assert_equal turbo_partial, index.resolve("posts/row", turbo_caller).first
      end
    end

    test "extension precedence still decides when no format matches" do
      Dir.mktmpdir do |dir|
        views = File.join(dir, "app", "views")

        turbo_caller = write(views, "posts/index.turbo_stream.erb")
        html_partial = write(views, "posts/_row.html.erb")

        index = Herb::Analysis::PartialIndex.new([views], [turbo_caller, html_partial])

        assert_equal html_partial, index.resolve("posts/row", turbo_caller).first
      end
    end
  end
end
