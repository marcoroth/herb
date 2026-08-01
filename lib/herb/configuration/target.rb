# frozen_string_literal: true

module Herb
  class Configuration
    # Resolves the friendly targets accepted by `herb config` into dotted paths
    # inside `.herb.yml`.
    #
    # `herb config disable linter` and `herb config disable html-img-require-alt`
    # both end up as a boolean write; this is the bit that decides where.
    module Target
      class UnknownTargetError < StandardError; end

      TOOLS = ["linter", "formatter"].freeze

      # Targets that live behind an `enabled` key rather than being booleans
      # themselves.
      TOGGLES = {
        "linter" => "linter.enabled",
        "formatter" => "formatter.enabled",
      }.freeze

      # Built-in rewriters and the position they can run in.
      #
      # Source of truth is `javascript/packages/rewriter/src/built-ins/index.ts`,
      # where an ASTRewriter is a `pre` rewriter and a StringRewriter is `post`.
      # This list is duplicated until a generated manifest exists.
      REWRITERS = {
        "action-view-tag-helper-to-html" => "pre",
        "erb-string-to-direct-output" => "pre",
        "html-to-action-view-tag-helper" => "pre",
        "tailwind-class-sorter" => "pre",
      }.freeze

      class << self
        # Resolve a target for `enable` / `disable` to a boolean path.
        #: (String) -> String
        def toggle_path(target)
          return TOGGLES.fetch(target) if TOGGLES.key?(target)
          return target if target.include?(".")

          if rewriter?(target)
            raise UnknownTargetError, "`#{target}` is a rewriter, which is enabled at #{rewriter_path(target)} rather than by a boolean"
          end

          "linter.rules.#{target}.enabled"
        end

        #: (String) -> bool
        def rewriter?(name)
          REWRITERS.key?(name)
        end

        #: (String) -> String
        def rewriter_path(name)
          "formatter.rewriter.#{REWRITERS.fetch(name)}"
        end

        # Resolve where an include/exclude pattern belongs.
        #
        # Without a tool or rule it lands in the top-level `files` section, which
        # applies to every tool.
        #: (String, ?tool: String?, ?rule: String?) -> String
        def pattern_path(kind, tool: nil, rule: nil)
          raise UnknownTargetError, "unknown pattern list: #{kind}" unless ["include", "exclude", "only"].include?(kind)

          return "linter.rules.#{rule}.#{kind}" if rule

          return "files.#{kind}" unless tool

          raise UnknownTargetError, "unknown tool: #{tool}" unless TOOLS.include?(tool)

          "#{tool}.#{kind}"
        end

        # Glob patterns are matched with `File.fnmatch?(pattern, path, FNM_PATHNAME)`,
        # so a bare directory name never matches the files inside it. Expand those
        # into a recursive glob rather than silently writing a pattern that matches
        # nothing.
        #: (String, ?root: String?) -> String
        def normalize_pattern(pattern, root: nil)
          normalized = pattern.delete_suffix("/")

          return normalized if normalized.match?(/[*?\[\]{}]/)

          directory = root ? File.join(root, normalized) : normalized

          return normalized unless File.directory?(directory)

          "#{normalized}/**/*"
        end
      end
    end
  end
end
