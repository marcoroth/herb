# frozen_string_literal: true

require "tmpdir"

require_relative "../test_helper"
require_relative "../../lib/herb/dev/watcher"

module Dev
  class WatcherTest < Minitest::Spec
    RawEvent = Struct.new(:kind, :path)

    def with_watcher
      Dir.mktmpdir do |root|
        root = File.realpath(root)
        events = []
        config = Herb::Configuration.load(root)
        watcher = Herb::Dev::Watcher.new(config: config, root: root) { |event| events << event }

        yield root, watcher, events
      end
    end

    def write(root, relative_path, content)
      path = File.join(root, relative_path)

      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, content)

      path
    end

    test "indexes the templates it finds and remembers their content" do
      with_watcher do |root, watcher, _events|
        path = write(root, "app/views/posts/index.html.erb", "<p>Hi</p>")

        assert_equal 1, watcher.index
        assert_equal "<p>Hi</p>", watcher.file_states[path]
      end
    end

    test "a first sighting is :added and carries no previous content" do
      with_watcher do |root, watcher, events|
        path = write(root, "index.html.erb", "<p>Hi</p>")

        watcher.send(:handle, RawEvent.new("created", path))

        assert_equal [:added], events.map(&:kind)
        assert_nil events.first.previous
        assert_equal "<p>Hi</p>", events.first.current
      end
    end

    test "a change carries the previous and the current content" do
      with_watcher do |root, watcher, events|
        path = write(root, "index.html.erb", "<p>Hi</p>")
        watcher.index

        write(root, "index.html.erb", "<p>Hello</p>")
        watcher.send(:handle, RawEvent.new("modified", path))

        assert_equal [:changed], events.map(&:kind)
        assert_equal "<p>Hi</p>", events.first.previous
        assert_equal "<p>Hello</p>", events.first.current
        assert_equal "index.html.erb", events.first.relative_path
      end
    end

    test "an event without a content change emits nothing" do
      with_watcher do |root, watcher, events|
        path = write(root, "index.html.erb", "<p>Hi</p>")
        watcher.index

        watcher.send(:handle, RawEvent.new("modified", path))

        assert_empty events
      end
    end

    test "a removal carries the content the file had" do
      with_watcher do |root, watcher, events|
        path = write(root, "index.html.erb", "<p>Hi</p>")
        watcher.index

        File.delete(path)
        watcher.send(:handle, RawEvent.new("removed", path))

        assert_equal [:removed], events.map(&:kind)
        assert_equal "<p>Hi</p>", events.first.previous
        assert_nil events.first.current
        refute watcher.file_states.key?(path)
      end
    end

    test "an excluded path emits nothing" do
      with_watcher do |root, watcher, events|
        path = write(root, "node_modules/thing/index.html.erb", "<p>Hi</p>")

        watcher.send(:handle, RawEvent.new("created", path))

        assert_empty events
      end
    end

    test "a file outside the include patterns emits nothing" do
      with_watcher do |root, watcher, events|
        path = write(root, "app/models/post.rb", "class Post; end")

        watcher.send(:handle, RawEvent.new("created", path))

        assert_empty events
      end
    end

    def watcher_for(root, watch_paths)
      Herb::Dev::Watcher.new(config: Herb::Configuration.load(root), root: root, watch_paths: watch_paths) { |event| event }
    end

    test "watches the project root when no watch paths are given" do
      Dir.mktmpdir do |root|
        root = File.realpath(root)

        assert_equal [root], watcher_for(root, nil).watch_paths
      end
    end

    test "watches only the directories it is given" do
      Dir.mktmpdir do |root|
        root = File.realpath(root)
        views = File.join(root, "app/views")
        components = File.join(root, "app/components")

        FileUtils.mkdir_p(views)
        FileUtils.mkdir_p(components)

        assert_equal [components, views], watcher_for(root, [views, components]).watch_paths
      end
    end

    test "ignores directories outside the project root" do
      Dir.mktmpdir do |root|
        Dir.mktmpdir do |outside|
          root = File.realpath(root)
          views = File.join(root, "app/views")

          FileUtils.mkdir_p(views)

          assert_equal [views], watcher_for(root, [views, File.realpath(outside)]).watch_paths
        end
      end
    end

    test "ignores paths that are not existing directories" do
      Dir.mktmpdir do |root|
        root = File.realpath(root)
        views = File.join(root, "app/views")

        FileUtils.mkdir_p(views)
        write(root, "app/views/index.html.erb", "<p>Hi</p>")

        watch_paths = watcher_for(root, [views, File.join(root, "nope"), File.join(root, "app/views/index.html.erb")]).watch_paths

        assert_equal [views], watch_paths
      end
    end

    test "collapses a nested directory into the one that already covers it" do
      Dir.mktmpdir do |root|
        root = File.realpath(root)
        views = File.join(root, "app/views")
        admin = File.join(views, "admin")

        FileUtils.mkdir_p(admin)

        assert_equal [views], watcher_for(root, [views, admin]).watch_paths
      end
    end

    test "falls back to the project root when nothing usable is left" do
      Dir.mktmpdir do |root|
        root = File.realpath(root)

        assert_equal [root], watcher_for(root, [File.join(root, "nope")]).watch_paths
      end
    end

    test "collapses to the project root when the root itself is included" do
      Dir.mktmpdir do |root|
        root = File.realpath(root)
        views = File.join(root, "app/views")

        FileUtils.mkdir_p(views)

        assert_equal [root], watcher_for(root, [root, views]).watch_paths
      end
    end
  end
end
