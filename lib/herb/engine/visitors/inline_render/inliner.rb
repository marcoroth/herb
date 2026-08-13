# frozen_string_literal: true

require_relative "../../../analysis/partial_resolution"

module Herb
  class Engine
    module Visitors
      class InlineRender
        class Inliner
          VIRTUAL_PATH_DEPENDENT = /\bI18n\.[tl]\b|\b(?:t|l|translate|localize)\(|\bcache\b/
          STRICT_LOCALS = /<%#[-\s]*locals:/

          attr_reader :filename

          def initialize(options = {})
            @project_path = options[:project_path] || Pathname.new(Dir.pwd)
            @filename = options[:filename]
            @view_root = find_view_root
            @source_directory = find_source_directory
            @format = find_format
          end

          def can_inline?(node, shadowed: [])
            return false unless node.static_partial?
            return false if node.body&.any?

            return can_inline_collection?(node, shadowed: shadowed) if node.keywords&.collection

            resolved = resolve_path(node)

            return false unless resolved

            safe_to_inline?(resolved, shadowed: shadowed)
          end

          def can_inline_collection?(node, shadowed: [])
            return false unless node.static_partial?
            return false if node.keywords&.spacer_template

            resolved = resolve_path(node)

            return false unless resolved

            safe_to_inline?(resolved, item: collection_item_name(node), shadowed: shadowed)
          end

          def collection?(node)
            !!node.keywords&.collection
          end

          def collection_expression(node)
            node.keywords&.collection&.value
          end

          def collection_item_name(node)
            as_name = node.keywords&.as_name&.value
            return as_name if as_name

            partial = node.partial_path
            return nil unless partial

            File.basename(partial)
          end

          def resolve_path(node)
            candidates = node.candidate_paths(nil, @view_root, @source_directory)

            return candidates.find(&:exist?) unless @format

            preferred, rest = candidates.partition { |path| path.basename.to_s.include?(".#{@format}.") }

            (preferred + rest).find(&:exist?)
          end

          def own_locals(source)
            require "prism"

            ::Prism.parse(::Herb.extract_ruby(source)).value.locals.map(&:to_s)
          rescue StandardError
            []
          end

          def local_assignments(node)
            locals = {} #: Hash[String, String]

            node.keywords&.locals&.each do |local|
              name = local.name&.value
              value = local.value&.content

              next unless name && value

              value = name if value == "#{name}:" # Shorthand hash syntax

              locals[name] = value
            end

            locals
          end

          private

          def safe_to_inline?(file_path, item: nil, shadowed: [])
            source = File.read(file_path)

            # TODO: we might want to revisit these three conditions later
            return false if source.include?("content_for")
            return false if source.match?(/\byield\b/)
            return false if source.include?("local_assigns")
            return false if source.match?(VIRTUAL_PATH_DEPENDENT)
            return false if source.match?(STRICT_LOCALS)
            return false if item && source.include?("#{item}_iteration")

            at_risk = shadowed - own_locals(source)

            return false if at_risk.any? { |name| source.match?(/\b#{Regexp.escape(name)}\b/) }

            true
          end

          def find_format
            return nil unless @filename

            parts = File.basename(@filename).split(".")

            parts.length >= 3 ? parts[-2] : nil
          end

          def find_view_root
            Analysis::PartialResolution.view_root_for(@project_path)
          end

          def find_source_directory
            return nil unless @filename

            @project_path.join(Pathname.new(@filename).dirname)
          end
        end
      end
    end
  end
end
