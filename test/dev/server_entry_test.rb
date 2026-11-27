# frozen_string_literal: true

require "socket"
require "tmpdir"

require_relative "../test_helper"
require_relative "../../lib/herb/dev/server_entry"

module Dev
  class ServerEntryTest < Minitest::Spec
    def free_port
      server = TCPServer.new("127.0.0.1", 0)
      server.addr[1]
    ensure
      server&.close
    end

    test "an entry whose process is alive but whose port has no listener is stale" do
      Dir.mktmpdir do |root|
        entry = Herb::Dev::ServerEntry.new(pid: Process.pid, port: free_port, project: root)
        entry.save

        begin
          assert_nil Herb::Dev::ServerEntry.find_by_project(root)
          refute File.exist?(File.join(Herb::Dev::ServerEntry::SERVERS_DIR, "#{Process.pid}.json"))
        ensure
          entry.remove
        end
      end
    end

    test "an entry whose process is alive and listens on its port is found" do
      Dir.mktmpdir do |root|
        listener = TCPServer.new("127.0.0.1", 0)
        entry = Herb::Dev::ServerEntry.new(pid: Process.pid, port: listener.addr[1], project: root)
        entry.save

        begin
          assert_equal entry.port, Herb::Dev::ServerEntry.find_by_project(root)&.port
        ensure
          entry.remove
          listener.close
        end
      end
    end

    test "a stale entry replaced while it is probed keeps the replacement" do
      Dir.mktmpdir do |root|
        stale_port = free_port
        replacement = Herb::Dev::ServerEntry.new(pid: Process.pid, port: free_port, project: root)
        registry = Class.new(Herb::Dev::ServerEntry) do
          define_singleton_method(:port_listening?) do |port|
            next super(port) unless port == stale_port

            replacement.save
            false
          end
        end
        Herb::Dev::ServerEntry.new(pid: Process.pid, port: stale_port, project: root).save

        begin
          registry.all

          assert_equal replacement.to_json, File.read(File.join(Herb::Dev::ServerEntry::SERVERS_DIR, "#{Process.pid}.json"))
        ensure
          replacement.remove
        end
      end
    end
  end
end
