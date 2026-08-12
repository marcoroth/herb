# frozen_string_literal: true

require "json"
require "fileutils"

module Herb
  module Dev
    class ServerEntry
      SERVERS_DIR = File.expand_path("~/.herb/dev-servers").freeze
      REQUIRED_KEYS = ["pid", "port", "project", "started_at"].freeze

      attr_reader :pid, :port, :project, :started_at

      def initialize(pid:, port:, project:, started_at: Time.now.utc.iso8601)
        @pid = pid
        @port = port
        @project = project
        @started_at = started_at
      end

      def save
        FileUtils.mkdir_p(SERVERS_DIR)
        File.write(file_path, to_json)
      end

      def remove
        File.delete(file_path)
      rescue StandardError
        nil
      end

      def alive?
        self.class.process_alive?(pid)
      end

      def to_hash
        { pid: pid, port: port, project: project, started_at: started_at }
      end

      def to_json(*)
        JSON.generate(to_hash)
      end

      def project_name
        project&.split("/")&.last || "unknown"
      end

      def stop!
        Process.kill("INT", pid)
        remove
        true
      rescue Errno::ESRCH
        remove
        false
      end

      class << self
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

        def find_by_port(port)
          all.find { |entry| entry.port == port }
        end

        def find_by_project(project_path)
          all.find { |entry| entry.project == project_path }
        end

        def stop_all
          all.each(&:stop!)
        end

        def process_alive?(pid)
          return false unless pid

          Process.kill(0, pid)
          true
        rescue Errno::ESRCH, Errno::EPERM
          false
        end

        private

        def load_file(path)
          data = JSON.parse(File.read(path))

          return nil unless data.is_a?(Hash) && REQUIRED_KEYS.all? { |key| data.key?(key) }

          new(
            pid: data["pid"],
            port: data["port"],
            project: data["project"],
            started_at: data["started_at"]
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

      def file_path
        File.join(SERVERS_DIR, "#{pid}.json")
      end
    end
  end
end
