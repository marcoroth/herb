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
  end
end
