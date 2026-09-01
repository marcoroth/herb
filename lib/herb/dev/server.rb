# frozen_string_literal: true

require "fileutils"
require "socket"
require "json"

begin
  require "websocket"
rescue LoadError
  require "bundler/inline"

  gemfile do
    source "https://rubygems.org"
    gem "websocket"
  end

  require "websocket"
end

require_relative "server_entry"

module Herb
  module Dev
    class Server
      DEFAULT_PORT = 8592 #: Integer # "HERB".bytes.map { (it - 64).digits.sum }.join
      HANDSHAKE_TIMEOUT = 5 #: Integer
      ROLES = [:browser, :app].freeze #: Array[Symbol]

      Client = Struct.new(:socket, :version, :mutex, :role, keyword_init: true)

      attr_reader :port #: Integer
      attr_reader :project_path #: String?

      #: (?port: Integer, ?project_path: String?, ?kind: String) -> void
      def initialize(port: DEFAULT_PORT, project_path: nil, kind: "standalone")
        @port = port
        @project_path = project_path
        @kind = kind
        @clients = [] #: Array[Client]
        @mutex = Mutex.new
        @server = nil
        @accept_thread = nil
        @entry = nil
      end

      #: () -> void
      def start
        @entry = ServerEntry.new(pid: Process.pid, port: @port, project: @project_path, kind: @kind)
        @entry.save
        @server = TCPServer.new("0.0.0.0", @port)

        @accept_thread = Thread.new do
          loop do
            socket = @server.accept
            Thread.new(socket) { |s| handle_connection(s) }
          rescue IOError
            break
          end
        end
      end

      #: () -> void
      def stop
        @mutex.synchronize do
          @clients.each { |client| safely_close(client.socket) }
          @clients.clear
        end

        safely_close(@server)

        @accept_thread&.kill
        @entry&.remove
      end

      #: (Hash[Symbol, untyped] | String, ?to: Symbol) -> void
      def broadcast(message, to: :all)
        data = message.is_a?(String) ? message : JSON.generate(message)

        failed_clients = []
        clients_snapshot = @mutex.synchronize { @clients.dup }
        clients_snapshot = clients_snapshot.select { |client| client.role == :browser } if to == :browsers

        clients_snapshot.each do |client|
          frame = WebSocket::Frame::Outgoing::Server.new(version: client.version, data: data, type: :text)

          client.mutex.synchronize do
            client.socket.write(frame.to_s)
            client.socket.flush
          end
        rescue StandardError
          safely_close(client.socket)

          failed_clients << client
        end

        return unless failed_clients.any?

        @mutex.synchronize do
          failed_clients.each { |client| @clients.delete(client) }
        end
      end

      #: () -> Integer
      def client_count
        @mutex.synchronize { @clients.size }
      end

      #: (Integer) -> bool
      def self.port_available?(port)
        server = TCPServer.new("0.0.0.0", port)
        server.close

        true
      rescue Errno::EADDRINUSE
        false
      end

      #: (?Integer) -> Integer?
      def self.find_available_port(starting_port = DEFAULT_PORT)
        port = starting_port

        loop do
          return port if port_available?(port)

          port += 1
          break if port > starting_port + 100
        end

        nil
      end

      #: (Client, String) -> void
      def handle_text_frame(client, data)
        message = JSON.parse(data)

        return unless message.is_a?(Hash)
        return unless message["type"] == "hello"

        role = message["role"].to_s.to_sym

        client.role = role if ROLES.include?(role)
      rescue JSON::ParserError
        nil
      end

      private

      #: (untyped) -> void
      def safely_close(resource)
        resource&.close
      rescue StandardError
        nil
      end

      #: (untyped) -> void
      def handle_connection(socket)
        socket.setsockopt(Socket::IPPROTO_TCP, Socket::TCP_NODELAY, 1)

        handshake = WebSocket::Handshake::Server.new

        until handshake.finished?
          readable = socket.wait_readable(HANDSHAKE_TIMEOUT)

          unless readable
            socket.close
            return
          end

          data = socket.read_nonblock(4096, exception: false)
          break if data.nil? || data == :wait_readable

          data.each_byte { |byte| handshake << byte.chr }
        end

        unless handshake.valid?
          socket.close
          return
        end

        socket.write(handshake.to_s)
        socket.flush

        welcome = WebSocket::Frame::Outgoing::Server.new(
          version: handshake.version,
          data: JSON.generate({ type: "welcome", project: @project_path }),
          type: :text
        )

        socket.write(welcome.to_s)
        socket.flush

        client = Client.new(socket: socket, version: handshake.version, mutex: Mutex.new, role: :browser)
        @mutex.synchronize { @clients << client }

        frame_parser = WebSocket::Frame::Incoming::Server.new(version: handshake.version)

        loop do
          chunk = socket.readpartial(4096)

          frame_parser << chunk

          while (frame = frame_parser.next)
            case frame.type
            when :close
              close_frame = WebSocket::Frame::Outgoing::Server.new(version: handshake.version, data: "", type: :close)

              begin
                client.mutex.synchronize { socket.write(close_frame.to_s) }
              rescue StandardError
                nil
              end

              return
            when :ping
              pong = WebSocket::Frame::Outgoing::Server.new(version: handshake.version, data: frame.data, type: :pong)

              client.mutex.synchronize { socket.write(pong.to_s) }
            when :text
              handle_text_frame(client, frame.data)
            end
          end
        end
      rescue IOError, Errno::ECONNRESET, Errno::EPIPE
        # client disconnected
      rescue StandardError => e
        warn "[Herb Dev Server] connection error: #{e.class}: #{e.message}"
      ensure
        @mutex.synchronize { @clients.delete_if { |client| client.socket == socket } }

        safely_close(socket)
      end
    end
  end
end
