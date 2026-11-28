# frozen_string_literal: true

require "fileutils"
require "socket"
require "json"
require "uri"

require_relative "../../herb"

Herb.ensure_installed("websocket")

require_relative "protocol"
require_relative "server_entry"

module Herb
  module Dev
    class Server
      DEFAULT_PORT = 8592 #: Integer # "HERB".bytes.map { (it - 64).digits.sum }.join
      HANDSHAKE_TIMEOUT = 5 #: Integer
      ROLES = [:browser, :app].freeze #: Array[Symbol]
      LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1"].freeze #: Array[String]
      ALLOWED_ORIGINS_VARIABLE = "HERB_DEV_ALLOWED_ORIGINS" #: String

      Client = Struct.new(:socket, :version, :mutex, :role, keyword_init: true)

      attr_reader :port #: Integer
      attr_reader :project_path #: String?

      #: (String) -> [String, String, Integer]?
      def self.origin_key(origin)
        uri = URI.parse(origin.strip)
        scheme = uri.scheme&.downcase
        hostname = uri.hostname&.downcase

        return nil unless ["http", "https"].include?(scheme) && hostname && !hostname.empty?

        [scheme, hostname, uri.port]
      rescue URI::InvalidURIError
        nil
      end

      #: (?port: Integer, ?project_path: String?, ?kind: String, ?allowed_origins: Array[String]) -> void
      def initialize(port: DEFAULT_PORT, project_path: nil, kind: "standalone", allowed_origins: ENV.fetch(ALLOWED_ORIGINS_VARIABLE, "").split(","))
        @port = port
        @project_path = project_path
        @kind = kind
        @allowed_origins = allowed_origins.filter_map { |origin| self.class.origin_key(origin) }
        @refused_origins = Set.new #: Set[String]
        @clients = [] #: Array[Client]
        @mutex = Mutex.new
        @server = nil
        @accept_thread = nil
        @entry = nil
        @on_client = nil #: (^(Symbol, Integer) -> void)?
        @on_welcome = nil #: (^() -> Array[Hash[Symbol, untyped]])?
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

        failed_clients.each { |client| unregister(client.socket) }
      end

      #: () { (Symbol, Integer) -> void } -> void
      def on_client(&block)
        @on_client = block
      end

      #: () { () -> Array[Hash[Symbol, untyped]] } -> void
      def on_welcome(&block)
        @on_welcome = block
      end

      #: (Client) -> void
      def register(client)
        count = @mutex.synchronize {
          @clients << client

          @clients.size
        }

        @on_client&.call(:connected, count)
      end

      #: (untyped) -> void
      def unregister(socket)
        removed = false
        count = 0

        @mutex.synchronize do
          before = @clients.size

          @clients.delete_if { |client| client.socket == socket }

          removed = @clients.size < before
          count = @clients.size
        end

        @on_client&.call(:disconnected, count) if removed
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

      #: (String?) -> bool
      def allowed_origin?(origin)
        return true if origin.nil?

        key = self.class.origin_key(origin)

        return false unless key

        hostname = key[1]

        LOOPBACK_HOSTS.include?(hostname) || hostname.end_with?(".localhost") || @allowed_origins.include?(key)
      end

      private

      #: (untyped, String) -> void
      def refuse(socket, origin)
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n")
        socket.flush

        return unless @mutex.synchronize { @refused_origins.add?(origin) }

        warn "[Herb Dev Server] refused a connection from #{origin}. Add it to #{ALLOWED_ORIGINS_VARIABLE} to allow it."
      end

      #: () -> Array[Hash[Symbol, untyped]]
      def broken_entries
        @on_welcome&.call || []
      rescue StandardError
        []
      end

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

        origin = handshake.headers["origin"]

        unless allowed_origin?(origin)
          refuse(socket, origin)
          return
        end

        socket.write(handshake.to_s)
        socket.flush

        welcome = WebSocket::Frame::Outgoing::Server.new(
          version: handshake.version,
          data: JSON.generate(Protocol.welcome(project: @project_path, broken_files: broken_entries)),
          type: :text
        )

        socket.write(welcome.to_s)
        socket.flush

        client = Client.new(socket: socket, version: handshake.version, mutex: Mutex.new, role: :browser)

        register(client)

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
        unregister(socket)

        safely_close(socket)
      end
    end
  end
end
