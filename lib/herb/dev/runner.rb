# frozen_string_literal: true
# typed: ignore

require_relative "../colors"
require_relative "../configuration"
require_relative "../diagnostic"
require_relative "../diagnostic/formatter"
require_relative "classifier"

module Herb
  module Dev
    class Runner
      include Herb::Colors

      PATCHABLE_TYPES = Herb::Dev::Classifier::PATCHABLE_TYPES #: Array[String]

      #: (Array[Herb::Diff::Operation]) -> bool
      def self.can_patch?(operations)
        Herb::Dev::Classifier.can_patch?(operations)
      end

      CLEAR_SCREEN = "\e[2J\e[H" #: String
      HIDE_CURSOR = "\e[?25l" #: String
      SHOW_CURSOR = "\e[?25h" #: String

      #: (?path: String) -> void
      def initialize(path: ".")
        @path = path
      end

      #: () -> void
      def run
        $stdout.sync = true

        require_cruise
        require_relative "server"
        require_relative "../dev"

        unless File.directory?(@path)
          puts "Not a directory: '#{@path}'."
          exit(1)
        end

        config = Herb::Configuration.load(@path)
        expanded_path = File.realpath(File.expand_path(config.project_root || @path))

        check_existing_server(expanded_path)
        port = find_port

        terminal(CLEAR_SCREEN)
        terminal(HIDE_CURSOR)
        print_header(config, expanded_path)

        websocket = Herb::Dev::Server.new(port: port, project_path: expanded_path)
        pipeline = Herb::Dev::Pipeline.new(server: websocket, configuration: config)
        pipeline.on_classified { |event, classification| paint(event, classification) }

        @first_change = true
        @broken_files = Set.new

        websocket.on_welcome { pipeline.broken_files }

        websocket.on_client do |event, count|
          announce_first_change
          paint_client(event, count)
        end

        watcher = Herb::Dev::Watcher.new(config: config, root: expanded_path) do |event|
          announce_first_change
          pipeline.handle_event(event)
        end

        index_files(watcher)

        @broken_files = watcher.broken_files.dup
        pipeline.remember_broken(watcher.broken_files)

        websocket.start

        puts "  #{fg("WebSocket:".ljust(11), 245)}#{fg("ws://localhost:#{websocket.port}", 250)}"
        puts
        puts "  #{fg("Ready!", 42)} #{fg("Watching for changes...", 241)}"
        puts

        watch_stdin
        watcher.run
      rescue Interrupt
        websocket&.stop
        terminal(SHOW_CURSOR)
        puts
        puts "Stopped."
        exit(0)
      ensure
        websocket&.stop
        terminal(SHOW_CURSOR)
      end

      #: () -> void
      def stop
        require_relative "server"

        entries = Herb::Dev::ServerEntry.all

        if entries.empty?
          puts "No herb dev servers running."
          exit(0)
        end

        entries.each do |entry|
          entry.stop!

          if entry.embedded?
            puts "Stopped the server for #{entry.project_name} (PID: #{entry.pid}, port: #{entry.port}). The Herb dev server was embedded in it, so the whole server shut down."
          else
            puts "Stopped herb dev server for #{entry.project_name} (PID: #{entry.pid}, port: #{entry.port})"
          end
        end

        exit(0)
      end

      #: () -> void
      def restart
        require_relative "server"

        Herb::Dev::ServerEntry.all.each(&:stop!)
        sleep 0.5
        run
      end

      #: () -> void
      def status
        require_relative "server"

        entries = Herb::Dev::ServerEntry.all

        if entries.empty?
          puts "No herb dev servers running."
        else
          entries.each do |entry|
            puts "#{entry.project_name} — PID: #{entry.pid}, port: #{entry.port}, #{entry.kind}, started: #{entry.started_at}"
          end
        end

        exit(0)
      end

      private

      #: () -> bool
      def interactive?
        $stdout.tty?
      end

      #: (String) -> void
      def terminal(sequence)
        print sequence if interactive?
      end

      #: (String, Array[Herb::Diagnostic], String) -> void
      def print_diagnostics(source, diagnostics, filename)
        return if diagnostics.empty?

        formatter = Herb::Diagnostic::Formatter.new(source, diagnostics, filename: filename)

        formatter.format_all(highlight: enabled?).each_line do |line|
          stripped = line.chomp

          puts stripped.empty? ? "" : "  #{stripped}"
        end
      end

      #: (Integer, String) -> String
      def pluralize(count, word)
        "#{count} #{word}#{"s" unless count == 1}"
      end

      #: () -> void
      def require_cruise
        Herb.ensure_installed("cruise")
      rescue StandardError
        abort <<~MESSAGE
          The 'cruise' gem is required for the Herb Dev Server.

          Install it:
            gem install cruise

          or add to your Gemfile:
            bundle add cruise
        MESSAGE
      end

      #: (String) -> void
      def check_existing_server(expanded_path)
        existing = Herb::Dev::ServerEntry.find_by_project(expanded_path)

        return unless existing

        if existing.embedded?
          puts "Herb dev server is already running for this project, embedded in another server for this app (PID: #{existing.pid}, port: #{existing.port})."
          puts
          puts "  herb dev stop       Stop it. The dev server lives inside that server, so this stops the whole server."
        else
          puts "Herb dev server is already running for this project (PID: #{existing.pid}, port: #{existing.port})."
          puts
          puts "  herb dev stop       Stop the running server"
          puts "  herb dev restart    Restart the server"
        end

        exit(1)
      end

      #: () -> Integer
      def find_port
        port = Herb::Dev::Server::DEFAULT_PORT
        port_owner = Herb::Dev::ServerEntry.find_by_port(port)

        if port_owner
          port = Herb::Dev::Server.find_available_port(port + 1)
          abort "No available ports found" unless port
        end

        port
      end

      #: (Herb::Configuration, String) -> void
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

      #: (Watcher) -> void
      def index_files(watcher)
        puts "  #{fg("Indexing files...", 241)}" if interactive?

        count = watcher.index(@path)
        broken = watcher.broken_files.size

        terminal("\e[1A\e[2K")
        puts "  #{fg("Files:".ljust(11), 245)}#{fg("#{pluralize(count, "template")} indexed", 250)}#{broken_summary(broken)}"
      end

      #: (Integer) -> String
      def broken_summary(broken)
        return "" unless broken.positive?

        fg(", #{broken} #{broken == 1 ? "doesn't" : "don't"} parse", 214)
      end

      #: () -> Thread
      def watch_stdin
        Thread.new do
          $stdin.gets(nil)
          Thread.main.raise(Interrupt)
        rescue IOError, Errno::EBADF
          Thread.main.raise(Interrupt)
        end
      end

      #: () -> void
      def announce_first_change
        return unless @first_change

        terminal("\e[2A\e[J")
        puts "  #{fg("Recent changes:", 245)}"
        puts
        @first_change = false
      end

      #: (Symbol, Integer) -> void
      def paint_client(event, count)
        timestamp = fg(Time.now.strftime("%H:%M:%S.%L"), 241)
        badge = event == :connected ? bold(fg("+ client ", 75)) : bold(fg("- client ", 241))

        puts "    #{timestamp} #{badge} #{fg(event.to_s, 250)} #{fg("(#{count} open)", 241)}"
      end

      #: (Watcher::Event, Classifier::Classification?) -> void
      def paint(event, classification)
        timestamp = fg(Time.now.strftime("%H:%M:%S.%L"), 241)
        display_path = fg(event.relative_path, 250)

        case event.kind
        when :removed
          @broken_files.delete(event.relative_path)
          puts "    #{timestamp} #{bold(fg("- removed", 196))} #{display_path}"
        when :added
          puts "    #{timestamp} #{bold(fg("+ added  ", 42))} #{display_path}"
        when :changed
          paint_change(event, classification, timestamp, display_path)
        end
      end

      #: (Watcher::Event, Classifier::Classification, String, String) -> void
      def paint_change(event, classification, timestamp, display_path)
        case classification&.kind
        when :parse_error
          @broken_files.add(event.relative_path)

          errors = new_errors(event, classification)

          unless errors.empty?
            print "    #{timestamp} #{bold(fg("\u{2717} error", 196))}"
            print_diagnostics(event.current.to_s, Herb::Diagnostic.from_errors(errors, template: event.relative_path), event.relative_path)
            puts
          end
        when :none, :whitespace, nil
          paint_cleared(event, timestamp, display_path)
        else
          if @broken_files.include?(event.relative_path)
            paint_cleared(event, timestamp, display_path)
          else
            print_diff_summary(classification, timestamp, display_path)
          end
        end
      end

      #: (Watcher::Event, Classifier::Classification) -> Array[Herb::Errors::Error]
      def new_errors(event, classification)
        previous_errors = Herb.parse(event.previous.to_s, strict: true, analyze: true).errors

        classification.errors.select { |error|
          previous_errors.none? { |previous_error|
            previous_error.error_name == error.error_name && previous_error.location.start.line == error.location.start.line
          }
        }
      end

      #: (Watcher::Event, String, String) -> void
      def paint_cleared(event, timestamp, display_path)
        return unless @broken_files.delete?(event.relative_path)

        puts "    #{timestamp} #{bold(fg("\u{2713} clear  ", 42))} #{display_path}"
        puts
      end

      #: (Classifier::Classification, String, String) -> void
      def print_diff_summary(classification, timestamp, display_path)
        operations = classification.operations

        badge = if classification.kind == :static
                  bold(fg("\u{2713} static ", 42))
                else
                  bold(fg("\u{21BB} fetch  ", 214))
                end

        puts "    #{timestamp} #{badge} #{display_path} #{fg("(#{pluralize(operations.size, "operation")})", 241)}"

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

      #: (String, String, Integer, Herb::AST::Node, String) -> void
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

      #: (Herb::AST::Node?) -> String?
      def extract_node_value(node)
        return nil unless node

        if node.is_a?(Herb::AST::HTMLTextNode)
          return node.content&.to_s
        end

        if node.is_a?(Herb::AST::ERBContentNode) || node.is_a?(Herb::AST::HerbDirectiveNode) || node.is_a?(Herb::AST::HerbStateDirectiveNode)
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
