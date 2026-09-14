# frozen_string_literal: true

require "tmpdir"

require_relative "../test_helper"
require_relative "../../lib/herb/dev"
require_relative "../../lib/herb/dev/server"

module Dev
  class BootTest < Minitest::Spec
    def teardown
      Herb::Dev.shutdown
      Herb::Dev.compiler = nil
      super
    end

    def quiet
      ->(message) { (@logged ||= []) << message }
    end

    def logged
      @logged || []
    end

    test "boots nothing outside development" do
      Dir.mktmpdir do |root|
        assert_nil Herb::Dev.boot(root, environment: "production", logger: quiet)
        assert_nil Herb::Dev.booted
      end
    end

    test "boots nothing when a standalone server owns the project" do
      Dir.mktmpdir do |root|
        expanded = File.realpath(root)
        entry = Herb::Dev::ServerEntry.new(pid: Process.pid, port: 65_001, project: expanded)
        entry.save

        begin
          assert_nil Herb::Dev.boot(root, environment: "development", logger: quiet)
          assert(logged.any? { |message| message.include?("already running") })
        ensure
          entry.remove
        end
      end
    end

    test "boots once and answers the same handle for a second call" do
      Dir.mktmpdir do |root|
        first = Herb::Dev.boot(root, environment: "development", logger: quiet)

        skip "cruise unavailable" if first.nil? && logged.any? { |message| message.include?("cruise") }

        refute_nil first

        second = Herb::Dev.boot(root, environment: "development", logger: quiet)

        assert_same first, second
      ensure
        Herb::Dev.shutdown
      end
    end

    test "a booted server registers itself so the port is discoverable" do
      Dir.mktmpdir do |root|
        embedded = Herb::Dev.boot(root, environment: "development", logger: quiet)

        skip "cruise unavailable" if embedded.nil?

        expanded = File.realpath(root)
        entry = Herb::Dev::ServerEntry.find_by_project(expanded)

        assert_equal embedded.server.port, Herb::Dev::ServerEntry.port_for(expanded)
        assert_predicate entry, :embedded?
      ensure
        Herb::Dev.shutdown
      end
    end

    test "logs one line per template event through the boot logger" do
      Dir.mktmpdir do |root|
        embedded = Herb::Dev.boot(root, environment: "development", logger: quiet)

        skip "cruise unavailable" if embedded.nil?

        logged.clear

        embedded.pipeline.handle_event(
          Herb::Dev::Watcher::Event.new(
            kind: :changed,
            path: "#{root}/a.html.erb",
            relative_path: "a.html.erb",
            previous: "<p>Hi</p>",
            current: "<p>Hello</p>"
          )
        )

        assert_equal ["a.html.erb changed (static, 1 operation)"], logged
      ensure
        Herb::Dev.shutdown
      end
    end

    test "shutdown stops the server and clears the registry entry" do
      Dir.mktmpdir do |root|
        embedded = Herb::Dev.boot(root, environment: "development", logger: quiet)

        skip "cruise unavailable" if embedded.nil?

        expanded = File.realpath(root)

        Herb::Dev.shutdown

        assert_nil Herb::Dev.booted
        assert_nil Herb::Dev::ServerEntry.find_by_project(expanded)
      end
    end
  end
end
