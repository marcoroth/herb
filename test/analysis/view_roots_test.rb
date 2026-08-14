# frozen_string_literal: true

require_relative "../test_helper"
require_relative "../../lib/herb/analysis/partial_index"

require "tmpdir"

module Analysis
  class ViewRootsTest < Minitest::Spec
    def write(root, relative, body = "<div></div>\n")
      path = File.join(root, relative)

      FileUtils.mkdir_p(File.dirname(path))
      File.write(path, body)

      path
    end

    test "names a partial from a secondary view root" do
      Dir.mktmpdir do |dir|
        app = File.join(dir, "app", "views")
        engine = File.join(dir, "engines", "billing", "app", "views")

        entry = write(app, "home/index.html.erb")
        invoice = write(engine, "billing/_invoice.html.erb")

        index = Herb::Analysis::PartialIndex.new([app, engine], [entry, invoice])

        assert_equal ["billing/invoice"], index.names
      end
    end

    test "an earlier view root shadows a later one" do
      Dir.mktmpdir do |dir|
        app = File.join(dir, "app", "views")
        engine = File.join(dir, "engines", "billing", "app", "views")

        engine_invoice = write(engine, "billing/_invoice.html.erb", "<div>engine</div>\n")
        app_invoice = write(app, "billing/_invoice.html.erb", "<div>app</div>\n")

        index = Herb::Analysis::PartialIndex.new([app, engine], [engine_invoice, app_invoice])
        resolved = index.resolve("billing/invoice", nil)

        assert_equal 2, resolved.size
        assert_equal app_invoice, resolved.first
      end
    end

    test "resolves a sibling within the root that owns the caller" do
      Dir.mktmpdir do |dir|
        app = File.join(dir, "app", "views")
        engine = File.join(dir, "engines", "billing", "app", "views")

        entry = write(engine, "billing/index.html.erb")
        row = write(engine, "billing/_row.html.erb")

        index = Herb::Analysis::PartialIndex.new([app, engine], [entry, row])

        assert_equal [row], index.resolve("row", entry)
      end
    end

    test "a single root still resolves" do
      Dir.mktmpdir do |dir|
        app = File.join(dir, "app", "views")
        header = write(app, "shared/_header.html.erb")

        index = Herb::Analysis::PartialIndex.new([app], [header])

        assert_equal ["shared/header"], index.names
        assert_equal [header], index.resolve("shared/header", nil)
      end
    end
  end
end
