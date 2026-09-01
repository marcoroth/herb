# frozen_string_literal: true
# typed: true

module Herb
  module Dev
    class Embedded
      #: (Server, Watcher, Pipeline, Integer) -> void
      def initialize(server, watcher, pipeline, pid)
        @server = server
        @watcher = watcher
        @pipeline = pipeline
        @pid = pid
      end

      attr_reader :server #: Server
      attr_reader :watcher #: Watcher
      attr_reader :pipeline #: Pipeline
      attr_reader :pid #: Integer

      #: () -> void
      def stop
        @watcher.stop
        @server.stop
      end
    end
  end
end
