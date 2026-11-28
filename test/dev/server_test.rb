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

    def handshake_response(server, origin: nil)
      listener = TCPServer.new("127.0.0.1", 0)
      client = TCPSocket.new("127.0.0.1", listener.addr[1])
      handler = Thread.new(listener.accept) { |socket| server.send(:handle_connection, socket) }

      request = [
        "GET / HTTP/1.1",
        "Host: localhost:#{Herb::Dev::Server::DEFAULT_PORT}",
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==",
        "Sec-WebSocket-Version: 13"
      ]
      request << "Origin: #{origin}" if origin

      client.write("#{request.join("\r\n")}\r\n\r\n")
      client.wait_readable(5)
      client.readpartial(4096)
    ensure
      client&.close
      handler&.join(5)
      listener&.close
    end

    def register(server, client)
      server.instance_variable_get(:@clients) << client
    end

    test "the welcome payload reports what the server was told is broken" do
      server = build_server
      server.on_welcome { [{ file: "a.html.erb" }] }

      assert_equal [{ file: "a.html.erb" }], server.send(:broken_entries)
    end

    test "a server nobody told about broken templates welcomes with an empty list" do
      assert_equal [], build_server.send(:broken_entries)
    end

    test "a welcome hook that raises still lets the client connect" do
      server = build_server
      server.on_welcome { raise "boom" }

      assert_equal [], server.send(:broken_entries)
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

    test "registering and unregistering a client notifies with the open count" do
      server = build_server
      events = []

      server.on_client { |event, count| events << [event, count] }

      first = Herb::Dev::Server::Client.new(socket: FakeSocket.new, version: 13, mutex: Mutex.new, role: :browser)
      second = Herb::Dev::Server::Client.new(socket: FakeSocket.new, version: 13, mutex: Mutex.new, role: :browser)

      server.register(first)
      server.register(second)
      server.unregister(first.socket)

      assert_equal [[:connected, 1], [:connected, 2], [:disconnected, 1]], events
    end

    test "unregistering an unknown socket notifies nothing" do
      server = build_server
      events = []

      server.on_client { |event, count| events << [event, count] }

      server.unregister(FakeSocket.new)

      assert_empty events
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

    test "a handshake without an origin is accepted" do
      assert_match(%r{\AHTTP/1\.1 101}, handshake_response(build_server))
    end

    test "a handshake from a loopback page is accepted" do
      server = build_server

      ["http://localhost:3000", "https://app.localhost", "http://127.0.0.1:3000", "http://[::1]:3000"].each do |origin|
        assert_match(%r{\AHTTP/1\.1 101}, handshake_response(server, origin: origin), origin)
      end
    end

    test "a handshake from an allowed origin is accepted" do
      server = Herb::Dev::Server.new(port: 0, project_path: "/tmp/project", allowed_origins: ["https://app.example.com/"])

      assert_match(%r{\AHTTP/1\.1 101}, handshake_response(server, origin: "https://app.example.com"))
    end

    test "a handshake from any other page is refused without a welcome" do
      server = build_server

      ["https://evil.example.com", "null", "http://localhost.example.com", "http://127.0.0.1.example.com"].each do |origin|
        response = nil

        assert_output("", /refused/) { response = handshake_response(server, origin: origin) }
        assert_equal "HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", response, origin
      end
    end

    test "a refused origin is logged once" do
      server = build_server

      _, logged = capture_io do
        handshake_response(server, origin: "https://evil.example.com")
        handshake_response(server, origin: "https://evil.example.com")
      end

      assert_equal 1, logged.scan("https://evil.example.com").size
    end
  end
end
