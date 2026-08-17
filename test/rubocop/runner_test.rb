# frozen_string_literal: true

require_relative "../test_helper"
require "fileutils"
require "rubocop"
require "tmpdir"

module Herb
  module Rubocop
    class RunnerTest < Minitest::Spec
      def setup
        @temp_dir = Dir.mktmpdir("herb_rubocop_test")
      end

      def teardown
        FileUtils.rm_rf(@temp_dir)
      end

      test "reports RuboCop offenses at their template locations" do
        runner = build_runner({
          "Layout/SpaceAroundOperators" => { "Enabled" => true },
        })
        source = "<div>\n  <%= x=1 %>\n</div>\n"

        offenses, = runner.inspect_source(source, template_path)

        assert_equal 1, offenses.length
        assert_equal "Layout/SpaceAroundOperators", offenses.first.cop_name
        assert_equal 2, offenses.first.location.start.line
        assert_equal 7, offenses.first.location.start.column
      end

      test "preserves Unicode when mapping offense locations" do
        runner = build_runner({
          "Layout/SpaceAroundOperators" => { "Enabled" => true },
        })
        source = "<p>Café <%= x=1 %></p>\n"

        offenses, = runner.inspect_source(source, template_path)

        assert_equal 1, offenses.length
        assert_equal 13, offenses.first.location.start.column
      end

      test "does not inspect ERB comments" do
        runner = build_runner({
          "Layout/SpaceAroundOperators" => { "Enabled" => true },
        })

        offenses, = runner.inspect_source("<%# x=1 %>\n", template_path)

        assert_empty offenses
      end

      test "honors only" do
        runner = build_runner(
          {
            "Layout/SpaceAroundOperators" => { "Enabled" => true },
            "Style/StringLiterals" => { "Enabled" => true },
          },
          only: ["Style/StringLiterals"]
        )

        offenses, = runner.inspect_source("<%= x=1 %><%= \"hello\" %>\n", template_path)

        assert_equal ["Style/StringLiterals"], offenses.map(&:cop_name)
      end

      test "honors RuboCop Exclude using the template filename" do
        runner = build_runner({
          "Layout/SpaceAroundOperators" => {
            "Enabled" => true,
            "Exclude" => ["app/views/excluded.html.erb"],
          },
        })

        offenses, = runner.inspect_source("<%= x=1 %>\n", template_path("app/views/excluded.html.erb"))

        assert_empty offenses
      end

      test "loads custom cops from relative require paths" do
        File.write(File.join(@temp_dir, "custom_cop.rb"), <<~RUBY)
          module RuboCop
            module Cop
              module HerbTest
                class NoFoo < Base
                  MSG = "Do not call foo."

                  def on_send(node)
                    add_offense(node) if node.method_name == :foo
                  end
                end
              end
            end
          end
        RUBY

        runner = build_runner(
          {
            "require" => ["./custom_cop"],
            "HerbTest/NoFoo" => { "Enabled" => true },
          }
        )

        offenses, = runner.inspect_source("<%= foo %>\n", template_path)

        assert_equal ["HerbTest/NoFoo"], offenses.map(&:cop_name)
      end

      test "autocorrects only Ruby inside the ERB tag" do
        path = template_path
        FileUtils.mkdir_p(File.dirname(path))
        File.write(path, "<div class=\"x\"><%= x=1 %></div>\n")
        runner = build_runner({
          "Layout/SpaceAroundOperators" => { "Enabled" => true },
        })

        result = runner.inspect_file(path, autocorrect: true)

        assert result.success?
        assert_equal "<div class=\"x\"><%= x = 1 %></div>\n", File.read(path)
      end

      test "supports config_file_path" do
        config_path = File.join(@temp_dir, "rubocop-erb.yml")
        File.write(config_path, <<~YAML)
          AllCops:
            DisabledByDefault: true
          Layout/SpaceAroundOperators:
            Enabled: true
        YAML

        runner = build_runner({}, config_file_path: "rubocop-erb.yml")
        offenses, = runner.inspect_source("<%= x=1 %>\n", template_path)

        assert_equal ["Layout/SpaceAroundOperators"], offenses.map(&:cop_name)
      end

      private

      def build_runner(rubocop_config, only: nil, config_file_path: nil)
        config = {
          "rubocop" => {
            "enabled" => true,
            "rubocop_config" => {
              "AllCops" => { "DisabledByDefault" => true },
            }.merge(rubocop_config),
          },
        }
        config["rubocop"]["only"] = only if only
        config["rubocop"]["config_file_path"] = config_file_path if config_file_path

        herb_configuration = Herb::Configuration.new(@temp_dir)
        herb_configuration.instance_variable_set(
          :@config,
          Herb::Configuration::DEFAULTS.merge(config)
        )

        Runner.new(Configuration.new(herb_configuration))
      end

      def template_path(relative = "app/views/example.html.erb")
        File.join(@temp_dir, relative)
      end
    end
  end
end
