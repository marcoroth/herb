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

      attr_reader :port, :project_path

      def initialize(port: DEFAULT_PORT, project_path: nil)
        @port = port
        @project_path = project_path
        @clients = []
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
            client = @server.accept
            Thread.new(client) { |socket| handle_connection(socket) }
          rescue IOError
            break
          end
        end
      end

      def stop
        @mutex.synchronize do
          @clients.each { |client|
            begin
              client.close
            rescue StandardError
              nil
            end
          }

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
        frame = WebSocket::Frame::Outgoing::Server.new(version: 13, data: data, type: :text)

        @mutex.synchronize do
          @clients.reject! do |client|
            client.write(frame.to_s)
            false
          rescue StandardError
            begin
              client.close
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
        data = +""

        until handshake.finished?
          byte = socket.getc
          break if byte.nil?

          data << byte
          handshake << byte
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

        @mutex.synchronize { @clients << socket }

        frame_parser = WebSocket::Frame::Incoming::Server.new(version: handshake.version)

        loop do
          chunk = socket.readpartial(4096)

          frame_parser << chunk

          while (frame = frame_parser.next)
            case frame.type
            when :close
              close_frame = WebSocket::Frame::Outgoing::Server.new(version: handshake.version, data: "", type: :close)

              begin
                socket.write(close_frame.to_s)
              rescue StandardError
                nil
              end

              return
            when :ping
              pong = WebSocket::Frame::Outgoing::Server.new(version: handshake.version, data: frame.data, type: :pong)
              socket.write(pong.to_s)
            end
          end
        end
      rescue IOError, Errno::ECONNRESET, Errno::EPIPE
        # client disconnected
      rescue StandardError => e
        warn "[herb-dev-server] connection error: #{e.class}: #{e.message}"
      ensure
        @mutex.synchronize { @clients.delete(socket) }

        begin
          socket.close
        rescue StandardError
          nil
        end
      end
    end
  end
end
