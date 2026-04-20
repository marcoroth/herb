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
      DEFAULT_PORT = 8592
      HANDSHAKE_TIMEOUT = 5

      attr_reader :port, :project_path

      Client = Data.define(:socket, :version, :mutex)

      def initialize(port: DEFAULT_PORT, project_path: nil)
        @port = port
        @project_path = project_path
        @clients = [] #: Array[Client]
        @mutex = Mutex.new
        @server = nil
        @entry = nil
      end

      def start
        @entry = ServerEntry.new(pid: Process.pid, port: @port, project: @project_path)
        @entry.save
        @server = TCPServer.new("0.0.0.0", @port)

        Thread.new do
          loop do
            socket = @server.accept
            Thread.new(socket) { |s| handle_connection(s) }
          rescue IOError
            break
          end
        end
      end

      def stop
        @mutex.synchronize do
          @clients.each do |client|
            client.socket.close
          rescue StandardError
            nil
          end

          @clients.clear
        end

        begin
          @server&.close
        rescue StandardError
          nil
        end

        @entry&.remove
      end

      def broadcast(message)
        data = message.is_a?(String) ? message : JSON.generate(message)

        @mutex.synchronize do
          @clients.reject! do |client|
            frame = WebSocket::Frame::Outgoing::Server.new(version: client.version, data: data, type: :text)

            client.mutex.synchronize do
              client.socket.write(frame.to_s)
              client.socket.flush
            end

            false
          rescue StandardError
            begin
              client.socket.close
            rescue StandardError
              nil
            end
            true
          end
        end
      end

      def client_count
        @mutex.synchronize { @clients.size }
      end

      def self.port_available?(port)
        server = TCPServer.new("0.0.0.0", port)
        server.close

        true
      rescue Errno::EADDRINUSE
        false
      end

      def self.find_available_port(starting_port = DEFAULT_PORT)
        port = starting_port

        loop do
          return port if port_available?(port)

          port += 1
          break if port > starting_port + 100
        end

        nil
      end

      private

      def handle_connection(socket)
        socket.setsockopt(Socket::IPPROTO_TCP, Socket::TCP_NODELAY, 1)

        handshake = WebSocket::Handshake::Server.new

        until handshake.finished?
          readable = IO.select([socket], nil, nil, HANDSHAKE_TIMEOUT)

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

        client = Client.new(socket: socket, version: handshake.version, mutex: Mutex.new)
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
            end
          end
        end
      rescue IOError, Errno::ECONNRESET, Errno::EPIPE
        # client disconnected
      rescue StandardError => e
        warn "[herb-dev-server] connection error: #{e.class}: #{e.message}"
      ensure
        @mutex.synchronize { @clients.delete_if { |c| c.socket == socket } }

        begin
          socket.close
        rescue StandardError
          nil
        end
      end
    end
  end
end
