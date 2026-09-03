# frozen_string_literal: true
# typed: true

require "digest"

module Herb
  module Dev
    # Tracks the build outputs a project's asset watchers write.
    #
    # A build tool rewrites its output on every run, and most runs change nothing,
    # so only a moved digest counts as a change.
    #
    class Assets
      ROOT = "app/assets/builds" #: String
      PATTERNS = ["#{ROOT}/**/*.css", "#{ROOT}/**/*.js"].freeze #: Array[String]

      #: () -> void
      def initialize
        @digests = {} #: Hash[String, String]
      end

      #: (String) -> Symbol
      def self.kind_for(path)
        path.end_with?(".css") ? :stylesheet : :script
      end

      #: (String) -> void
      def index(root)
        PATTERNS.each do |pattern|
          Dir.glob(File.join(root, pattern)).each do |asset|
            @digests[asset] = Digest::SHA256.file(asset).hexdigest
          rescue StandardError
            nil
          end
        end
      end

      #: (String) -> bool
      def changed?(path)
        return false unless File.exist?(path)

        digest = Digest::SHA256.file(path).hexdigest

        return false if @digests[path] == digest

        @digests[path] = digest

        true
      rescue StandardError
        false
      end
    end
  end
end
