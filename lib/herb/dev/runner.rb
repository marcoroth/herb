# frozen_string_literal: true
# typed: ignore

require_relative "../colors"

module Herb
  module Dev
    class Runner
      include Herb::Colors

      PATCHABLE_TYPES = ["text_changed", "attribute_value_changed", "attribute_added", "attribute_removed"].freeze #: Array[String]

      def self.can_patch?(operations)
        operations.all? { |operation|
          next false unless PATCHABLE_TYPES.include?(operation.type.to_s)
          next false if operation.new_node&.type&.to_s&.include?("ERB")
          next false if operation.old_node&.type&.to_s&.include?("ERB")

          true
        }
      end

      CLEAR_SCREEN = "\e[2J\e[H"
      HIDE_CURSOR = "\e[?25l"
      SHOW_CURSOR = "\e[?25h"

      def initialize(path: ".", cli: nil)
        @path = path
        @cli = cli
      end

      def run
        require_cruise
        require_relative "server"

        unless File.directory?(@path)
          puts "Not a directory: '#{@path}'."
          exit(1)
        end

        config = Herb::Configuration.load(@path)
        expanded_path = File.realpath(File.expand_path(config.project_root || @path))

        check_existing_server(expanded_path)
        port = find_port

        print CLEAR_SCREEN
        print HIDE_CURSOR
        print_header(config, expanded_path)

        file_states = index_files(config, @path)

        websocket = Herb::Dev::Server.new(port: port, project_path: expanded_path)
        websocket.start

        puts "  #{fg("WebSocket:".ljust(11), 245)}#{fg("ws://localhost:#{websocket.port}", 250)}"
        puts
        puts "  #{fg("Ready!", 42)} #{fg("Watching for changes...", 241)}"
        puts

        watch_files(config, expanded_path, websocket, file_states)
      rescue Interrupt
        websocket&.stop
        print SHOW_CURSOR
        puts
        puts "Stopped."
        exit(0)
      ensure
        websocket&.stop
        print SHOW_CURSOR
      end

      def stop
        require_relative "server"

        entries = Herb::Dev::ServerEntry.all

        if entries.empty?
          puts "No herb dev servers running."
          exit(0)
        end

        entries.each do |entry|
          entry.stop!
          puts "Stopped herb dev server for #{entry.project_name} (PID: #{entry.pid}, port: #{entry.port})"
        end

        exit(0)
      end

      def restart
        require_relative "server"

        Herb::Dev::ServerEntry.all.each(&:stop!)
        sleep 0.5
        run
      end

      def status
        require_relative "server"

        entries = Herb::Dev::ServerEntry.all

        if entries.empty?
          puts "No herb dev servers running."
        else
          entries.each do |entry|
            puts "#{entry.project_name} — PID: #{entry.pid}, port: #{entry.port}, started: #{entry.started_at}"
          end
        end

        exit(0)
      end

      private

      def pluralize(count, word)
        "#{count} #{word}#{"s" unless count == 1}"
      end

      def require_cruise
        require "cruise"
      rescue LoadError
        abort <<~MESSAGE
          The 'cruise' gem is required for the Herb Dev Server.

          Install it:
            gem install cruise

          or add to your Gemfile:
            bundle add cruise
        MESSAGE
      end

      def check_existing_server(expanded_path)
        existing = Herb::Dev::ServerEntry.find_by_project(expanded_path)

        return unless existing

        puts "Herb dev server is already running for this project (PID: #{existing.pid}, port: #{existing.port})."
        puts
        puts "  herb dev stop       Stop the running server"
        puts "  herb dev restart    Restart the server"
        exit(1)
      end

      def find_port
        port = Herb::Dev::Server::DEFAULT_PORT
        port_owner = Herb::Dev::ServerEntry.find_by_port(port)

        if port_owner
          port = Herb::Dev::Server.find_available_port(port + 1)
          abort "No available ports found" unless port
        end

        port
      end

      def print_header(config, expanded_path)
        puts
        puts fg_bg(" \u{1F33F} Herb Dev Server ", 255, 28)
        puts
        puts "  #{fg("\u26A0\uFE0F Experimental:", 214)} #{fg("The dev server is experimental and may not work correctly in all cases.", 241)}"
        puts

        puts "  #{fg("Herb:".ljust(11), 245)}#{fg(Herb::VERSION, 250)}"
        puts "  #{fg("Project:".ljust(11), 245)}#{fg(expanded_path, 250)}"
        puts "  #{fg("PID:".ljust(11), 245)}#{fg(Process.pid, 250)} #{fg("(#{File.join(Herb::Dev::ServerEntry::SERVERS_DIR, "#{Process.pid}.json")})", 241)}"

        if config.config_path
          relative_config = config.config_path.to_s.delete_prefix("#{expanded_path}/")
          puts "  #{fg("Config:".ljust(11), 245)}#{fg(relative_config, 250)}"
        else
          puts "  #{fg("Config:".ljust(11), 245)}#{fg("(defaults)", 241)}"
        end
      end

      def index_files(config, path)
        puts "  #{fg("Indexing files...", 241)}"

        file_states = {}
        initial_files = config.find_files(path)

        initial_files.each do |file_path|
          file_states[file_path] = File.read(file_path)
        rescue StandardError
          # skip files that can't be read
        end

        print "\e[1A\e[2K"
        puts "  #{fg("Files:".ljust(11), 245)}#{fg("#{file_states.size} templates indexed", 250)}"

        file_states
      end

      def watch_files(config, expanded_path, websocket, file_states)
        include_patterns = config.file_include_patterns
        exclude_patterns = config.file_exclude_patterns
        first_change = true
        errored_files = Set.new

        Thread.new do
          $stdin.gets(nil)
          Thread.main.raise(Interrupt)
        rescue IOError, Errno::EBADF
          Thread.main.raise(Interrupt)
        end

        Cruise.watch(expanded_path, only: ["created", "modified", "removed"]) do |event|
          file_path = event.path
          relative_path = file_path.delete_prefix("#{expanded_path}/")

          next if config.path_excluded?(relative_path, exclude_patterns)
          next unless config.path_included?(relative_path, include_patterns)

          if first_change
            print "\e[2A\e[J"
            puts "  #{fg("Recent changes:", 245)}"
            puts
            first_change = false
          end

          timestamp = fg(Time.now.strftime("%H:%M:%S.%L"), 241)
          display_path = fg(relative_path, 250)

          case event.kind
          when "created", "modified"
            handle_file_change(file_path, relative_path, file_states, errored_files, websocket, timestamp, display_path)
          when "removed"
            file_states.delete(file_path)
            badge = bold(fg("- removed", 196))
            puts "    #{timestamp} #{badge} #{display_path}"
          end
        end
      end

      def handle_file_change(file_path, relative_path, file_states, errored_files, websocket, timestamp, display_path)
        return unless File.exist?(file_path)

        current_content = File.read(file_path)
        previous_content = file_states[file_path]

        if previous_content.nil?
          file_states[file_path] = current_content
          badge = bold(fg("+ added  ", 42))
          puts "    #{timestamp} #{badge} #{display_path}"
          return
        end

        return if previous_content == current_content && !errored_files.include?(file_path)

        current_parse = Herb.parse(current_content, strict: true, analyze: true)

        if current_parse.errors.any?
          broadcast_errors(file_path, relative_path, current_parse, previous_content, errored_files, websocket, timestamp, display_path)
          return
        end

        if errored_files.delete?(file_path)
          broadcast_fixed(file_path, relative_path, current_content, file_states, websocket, timestamp, display_path)
          return
        end

        handle_diff(file_path, relative_path, current_content, previous_content, file_states, websocket, timestamp, display_path)
      end

      def broadcast_errors(file_path, relative_path, current_parse, previous_content, errored_files, websocket, timestamp, display_path)
        current_errors = current_parse.errors

        previous_parse = Herb.parse(previous_content, strict: true, analyze: true)
        previous_errors = previous_parse.errors

        new_errors = current_errors.select { |error|
          previous_errors.none? { |previous_error|
            previous_error.error_name == error.error_name && previous_error.location.start.line == error.location.start.line
          }
        }

        badge = bold(fg("\u{2717} error  ", 196))
        puts "    #{timestamp} #{badge} #{display_path} #{fg("(#{pluralize(current_errors.size, "error")})", 241)}"

        new_errors.each do |error|
          location = fg("#{relative_path}:#{error.location.start.line}:#{error.location.start.column}", 241)
          puts "                        #{fg(error.error_name, 196)} #{location}"
          puts "                        #{fg(error.message, 250)}" if error.message && !error.message.empty?
        end

        errored_files.add(file_path)

        if websocket.client_count.positive?
          websocket.broadcast({
            type: "error",
            file: relative_path,
            errors: current_errors.map { |error|
              {
                name: error.error_name,
                message: error.message,
                line: error.location.start.line,
                column: error.location.start.column,
              }
            },
          })
        end

        puts
      end

      def broadcast_fixed(file_path, relative_path, current_content, file_states, websocket, timestamp, display_path)
        file_states[file_path] = current_content
        badge = bold(fg("\u{2713} fixed  ", 42))
        puts "    #{timestamp} #{badge} #{display_path}"

        if websocket.client_count.positive?
          websocket.broadcast({ type: "fixed", file: relative_path })
        end

        puts
      end

      def handle_diff(file_path, relative_path, current_content, previous_content, file_states, websocket, timestamp, display_path)
        diff_result = Herb.diff(previous_content, current_content)
        file_states[file_path] = current_content

        return if diff_result.identical?

        operations = diff_result.operations
        can_patch = self.class.can_patch?(operations)

        if can_patch && websocket.client_count.positive?
          patch_operations = operations.map do |operation|
            {
              type: operation.type.to_s,
              path: operation.path,
              old_value: extract_node_value(operation.old_node),
              new_value: extract_node_value(operation.new_node),
              old_node_type: operation.old_node&.type,
              new_node_type: operation.new_node&.type,
            }
          end

          websocket.broadcast({
            type: "patch",
            file: relative_path,
            operations: patch_operations,
          })
        elsif !can_patch && websocket.client_count.positive?
          websocket.broadcast({
            type: "reload",
            file: relative_path,
          })
        end

        print_diff_summary(operations, can_patch, websocket, timestamp, display_path)
      end

      def print_diff_summary(operations, can_patch, websocket, timestamp, display_path)
        badge = if can_patch
                  bold(fg("\u{2713} patch ", 42))
                else
                  bold(fg("\u{21BB} reload ", 214))
                end

        clients_label = websocket.client_count.positive? ? " #{fg("[#{pluralize(websocket.client_count, "client")}]", 241)}" : ""
        puts "    #{timestamp} #{badge} #{display_path} #{fg("(#{pluralize(operations.size, "operation")})", 241)}#{clients_label}"

        operations.each_with_index do |operation, index|
          type = operation.type.to_s

          type_color = case type
                       when "node_inserted" then 114
                       when "node_removed", "attribute_removed" then 168
                       when "node_replaced", "tag_name_changed" then 173
                       when "node_wrapped", "node_unwrapped", "attribute_added", "attribute_value_changed" then 75
                       when "node_moved" then 73
                       when "text_changed" then 186
                       when "erb_content_changed" then 176
                       else 241
                       end

          type_label = type.tr("_", " ")
          index_label = fg("##{index + 1}", 241)
          path_label = fg("[#{operation.path.join(", ")}]", 241)
          indent = "                        "

          puts "#{indent}#{index_label} #{bold(fg(type_label, type_color))} #{path_label}"

          print_diff_node(indent, "-", 168, operation.old_node, type) if operation.old_node
          print_diff_node(indent, "+", 114, operation.new_node, type) if operation.new_node
        end

        puts
      end

      def print_diff_node(indent, sign, color, node, _type)
        value = extract_node_value(node)

        if value
          value.split("\n").each do |line|
            puts "#{indent}  #{fg(sign, color)} #{fg(line, color)}"
          end
        else
          label = node.type.to_s.sub("AST_", "").sub("_NODE", "")
          location = node.location ? " (#{node.location.start.line}:#{node.location.start.column})" : ""
          puts "#{indent}  #{fg(sign, color)} #{fg("#{label}#{location}", color)}"
        end
      end

      def extract_node_value(node)
        return nil unless node

        if node.is_a?(Herb::AST::HTMLTextNode)
          return node.content&.to_s
        end

        if node.is_a?(Herb::AST::ERBContentNode)
          return node.content&.value&.to_s
        end

        if node.is_a?(Herb::AST::HTMLElementNode)
          name = node.tag_name
          name = name.value if name.respond_to?(:value)
          return "<#{name}>"
        end

        if node.is_a?(Herb::AST::HTMLAttributeNode)
          parts = []

          if node.name.respond_to?(:children)
            parts << node.name.children.map { |child| child.respond_to?(:content) ? child.content.to_s : "" }.join
          end

          if node.value.respond_to?(:children)
            value = node.value.children.map { |child| child.respond_to?(:content) ? child.content.to_s : "" }.join
            parts << "=\"#{value}\""
          end

          result = parts.join
          return result.empty? ? nil : result
        end

        nil
      end
    end
  end
end
