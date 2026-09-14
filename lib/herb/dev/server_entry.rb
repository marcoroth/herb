# frozen_string_literal: true

require "json"
require "fileutils"

module Herb
  module Dev
    class ServerEntry
      SERVERS_DIR = File.expand_path("~/.herb/dev-servers").freeze #: String
      REQUIRED_KEYS = ["pid", "port", "project", "started_at"].freeze #: Array[String]

      KINDS = ["standalone", "embedded"].freeze #: Array[String]

      attr_reader :pid #: Integer
      attr_reader :port #: Integer
      attr_reader :project #: String?
      attr_reader :started_at #: String
      attr_reader :kind #: String

      #: (pid: Integer, port: Integer, project: String?, ?started_at: String, ?kind: String) -> void
      def initialize(pid:, port:, project:, started_at: Time.now.utc.iso8601, kind: "standalone")
        @pid = pid
        @port = port
        @project = project
        @started_at = started_at
        @kind = KINDS.include?(kind.to_s) ? kind.to_s : "standalone"
      end

      #: () -> bool
      def embedded?
        @kind == "embedded"
      end

      #: () -> void
      def save
        FileUtils.mkdir_p(SERVERS_DIR)
        File.write(file_path, to_json)
      end

      #: () -> void
      def remove
        File.delete(file_path)
      rescue StandardError
        nil
      end

      #: () -> bool
      def alive?
        self.class.process_alive?(pid)
      end

      #: () -> Hash[Symbol, untyped]
      def to_hash
        { pid: pid, port: port, project: project, started_at: started_at, kind: kind }
      end

      #: (*untyped) -> String
      def to_json(*)
        JSON.generate(to_hash)
      end

      #: () -> String
      def project_name
        project&.split("/")&.last || "unknown"
      end

      #: () -> bool
      def stop!
        Process.kill("INT", pid)
        remove
        true
      rescue Errno::ESRCH
        remove
        false
      end

      class << self
        #: () -> Array[ServerEntry]
        def all
          FileUtils.mkdir_p(SERVERS_DIR)

          Dir.glob(File.join(SERVERS_DIR, "*.json")).filter_map do |path|
            entry = load_file(path)

            if entry&.alive?
              entry
            else
              begin
                File.delete(path)
              rescue StandardError
                nil
              end
              nil
            end
          end
        end

        #: (Integer) -> ServerEntry?
        def find_by_port(port)
          all.find { |entry| entry.port == port }
        end

        #: (String) -> ServerEntry?
        def find_by_project(project_path)
          all.find { |entry| entry.project == project_path }
        end

        #: (?String?) -> Integer?
        def port_for(project_path = nil)
          find_by_project(project_path || Dir.pwd)&.port
        rescue StandardError
          nil
        end

        #: () -> void
        def stop_all
          all.each(&:stop!)
        end

        #: (Integer?) -> bool
        def process_alive?(pid)
          return false unless pid

          Process.kill(0, pid)
          true
        rescue Errno::ESRCH, Errno::EPERM
          false
        end

        private

        #: (String) -> ServerEntry?
        def load_file(path)
          data = JSON.parse(File.read(path))

          return nil unless data.is_a?(Hash) && REQUIRED_KEYS.all? { |key| data.key?(key) }

          new(
            pid: data["pid"],
            port: data["port"],
            project: data["project"],
            started_at: data["started_at"],
            kind: data["kind"] || "standalone"
          )
        rescue JSON::ParserError, Errno::ENOENT, Errno::EACCES
          begin
            File.delete(path)
          rescue StandardError
            nil
          end
          nil
        end
      end

      private

      #: () -> String
      def file_path
        File.join(SERVERS_DIR, "#{pid}.json")
      end
    end
  end
end
