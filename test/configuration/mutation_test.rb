# frozen_string_literal: true

require_relative "../test_helper"

class ConfigurationMutationTest < Minitest::Spec
  Mutation = Herb::Configuration::Mutation

  CONFIG = <<~YAML
    # This file configures Herb for your project and team.
    version: 0.10.3

    files:
      exclude:
        - 'tmp/**/*'

    linter:
      enabled: true

      # keep this comment
      rules:
        erb-no-extra-newline:
          enabled: false

    formatter:
      enabled: false
      indentWidth: 2
  YAML

  def mutate(yaml = CONFIG, &)
    mutation = Mutation.new(yaml)
    yield mutation
    mutation.to_yaml
  end

  describe "merge" do
    test "updates an existing scalar in place" do
      result = mutate { |m| m.merge({ "formatter" => { "enabled" => true } }) }

      assert_includes result, "formatter:\n  enabled: true\n"
    end

    test "preserves comments, blank lines and quote styles" do
      result = mutate { |m| m.merge({ "linter" => { "enabled" => false } }) }

      assert_includes result, "# This file configures Herb for your project and team."
      assert_includes result, "# keep this comment"
      assert_includes result, "- 'tmp/**/*'"
      assert_includes result, "\nfiles:\n"
    end

    test "inserts a missing nested branch as a block map" do
      result = mutate do |m|
        m.merge({ "linter" => { "rules" => { "html-img-require-alt" => { "enabled" => false } } } })
      end

      assert_includes result, "    html-img-require-alt:\n      enabled: false\n"
      refute_includes result, '"enabled: false"'
    end

    test "creates intermediate maps that do not exist yet" do
      result = mutate { |m| m.merge({ "engine" => { "validators" => { "security" => false } } }) }

      assert_includes result, "engine:\n  validators:\n    security: false\n"
    end

    test "leaves sibling rules untouched" do
      result = mutate do |m|
        m.merge({ "linter" => { "rules" => { "html-img-require-alt" => { "enabled" => false } } } })
      end

      assert_includes result, "    erb-no-extra-newline:\n      enabled: false\n"
    end
  end

  describe "set" do
    test "writes a dotted path" do
      result = mutate { |m| m.set("linter.rules.erb-no-extra-newline.enabled", true) }

      assert_includes result, "    erb-no-extra-newline:\n      enabled: true\n"
    end

    test "creates a deep path that does not exist" do
      result = mutate { |m| m.set("formatter.rewriter.pre", "tailwind-class-sorter") }

      assert_includes result, "  rewriter:\n    pre: tailwind-class-sorter\n"
    end

    test "writes integers unquoted" do
      result = mutate { |m| m.set("formatter.indentWidth", 4) }

      assert_includes result, "indentWidth: 4"
      refute_includes result, 'indentWidth: "4"'
    end
  end

  describe "unset" do
    test "removes a key" do
      result = mutate { |m| m.unset("formatter.indentWidth") }

      refute_includes result, "indentWidth"
      assert_includes result, "  enabled: false"
    end

    test "prunes containers left empty by the removal" do
      result = mutate { |m| m.unset("files.exclude") }

      refute_includes result, "files:"
      refute_includes result, "{}"
    end

    test "keeps containers that still hold other keys" do
      result = mutate { |m| m.unset("linter.rules.erb-no-extra-newline.enabled") }

      assert_includes result, "linter:"
      assert_includes result, "  enabled: true"
    end

    test "is a no-op for a path that is not present" do
      assert_equal(CONFIG, mutate { |m| m.unset("linter.failLevel") })
    end
  end

  describe "append" do
    test "adds to an existing sequence" do
      result = mutate { |m| m.append("files.exclude", "vendor/**/*") }

      assert_includes result, "    - 'tmp/**/*'\n    - 'vendor/**/*'\n"
    end

    test "inherits the quote style already used in the file" do
      result = mutate { |m| m.append("files.exclude", "vendor/**/*") }

      refute_includes result, '- "vendor/**/*"'
      refute_includes result, "- vendor/**/*\n"
    end

    test "is idempotent" do
      once = mutate { |m| m.append("files.exclude", "vendor/**/*") }
      twice = mutate(once) { |m| m.append("files.exclude", "vendor/**/*") }

      assert_equal once, twice
    end

    test "creates the sequence and its parents when missing" do
      result = mutate { |m| m.append("formatter.exclude", "app/views/admin/**/*") }

      assert_includes result, "  exclude:\n    - app/views/admin/**/*\n"
    end

    test "creates a rewriter pre list" do
      result = mutate { |m| m.append("formatter.rewriter.pre", "tailwind-class-sorter") }

      assert_includes result, "  rewriter:\n    pre:\n      - tailwind-class-sorter\n"
    end
  end

  describe "remove" do
    test "drops a value from a sequence" do
      result = mutate do |m|
        m.append("files.exclude", "vendor/**/*")
        m.remove("files.exclude", "vendor/**/*")
      end

      assert_equal CONFIG, result
    end

    test "prunes the container when the last value goes" do
      result = mutate { |m| m.remove("files.exclude", "tmp/**/*") }

      refute_includes result, "files:"
      refute_includes result, "[]"
    end

    test "is a no-op for a value that is not present" do
      assert_equal(CONFIG, mutate { |m| m.remove("files.exclude", "nope/**/*") })
    end
  end

  describe "round trips" do
    test "a no-op mutation returns the file byte for byte" do
      assert_equal(CONFIG, mutate { |m| m.merge({}) })
    end

    test "setting a value back restores the original bytes" do
      result = mutate do |m|
        m.set("formatter.enabled", true)
        m.set("formatter.enabled", false)
      end

      assert_equal CONFIG, result
    end
  end

  describe "mutate_config_file" do
    def setup
      @temp_dir = Dir.mktmpdir("herb_mutation_test")
      @config_path = File.join(@temp_dir, ".herb.yml")
    end

    def teardown
      FileUtils.rm_rf(@temp_dir)
    end

    test "writes the mutation back to disk" do
      File.write(@config_path, CONFIG)

      Mutation.mutate_config_file(@config_path, { "linter" => { "enabled" => false } })

      assert_includes File.read(@config_path), "linter:\n  enabled: false\n"
    end

    test "raises when the file does not exist" do
      error = assert_raises(Mutation::Error) do
        Mutation.mutate_config_file(@config_path, { "linter" => { "enabled" => false } })
      end

      assert_includes error.message, "no configuration file"
    end
  end
end
