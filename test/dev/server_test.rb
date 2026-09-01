# frozen_string_literal: true

require "json"
require "stringio"

require_relative "../test_helper"
require_relative "../../lib/herb/dev/server"

module Dev
  class ServerTest < Minitest::Spec
    class FakeSocket
      attr_reader :written #: Array[String]

      def initialize
        @written = []
      end

      def write(data)
        @written << data
      end

      def flush; end

      def close; end
    end

    def build_server
      Herb::Dev::Server.new(port: 0, project_path: "/tmp/project")
    end

    def build_client(role: :browser)
      Herb::Dev::Server::Client.new(socket: FakeSocket.new, version: 13, mutex: Mutex.new, role: role)
    end

    def register(server, client)
      server.instance_variable_get(:@clients) << client
    end

    test "a hello frame sets the client's role" do
      server = build_server
      client = build_client

      server.handle_text_frame(client, JSON.generate({ type: "hello", role: "app" }))

      assert_equal :app, client.role
    end

    test "a hello with an unknown role leaves the default" do
      server = build_server
      client = build_client

      server.handle_text_frame(client, JSON.generate({ type: "hello", role: "admin" }))

      assert_equal :browser, client.role
    end

    test "malformed frames change nothing and raise nothing" do
      server = build_server
      client = build_client

      server.handle_text_frame(client, "{not json")
      server.handle_text_frame(client, JSON.generate(["hello"]))
      server.handle_text_frame(client, JSON.generate({ type: "schema" }))

      assert_equal :browser, client.role
    end

    test "a broadcast reaches every client by default" do
      server = build_server
      browser = build_client
      app = build_client(role: :app)

      register(server, browser)
      register(server, app)

      server.broadcast({ type: "invalidate" })

      refute_empty browser.socket.written
      refute_empty app.socket.written
    end

    test "a broadcast to browsers skips the app" do
      server = build_server
      browser = build_client
      app = build_client(role: :app)

      register(server, browser)
      register(server, app)

      server.broadcast({ type: "schema" }, to: :browsers)

      refute_empty browser.socket.written
      assert_empty app.socket.written
    end
  end
end
