# frozen_string_literal: true

require_relative "../../test_helper"
require_relative "../../../lib/herb/engine"
require_relative "../../../lib/herb/engine/scoped_style/collector"

module Engine
  class ScopedStyleCollectorTest < Minitest::Spec
    PROJECT_PATH = "test/fixtures/scoped_styles"
    CARD = "test/fixtures/scoped_styles/app/views/posts/_card.html.erb"
    PLAIN = "test/fixtures/scoped_styles/app/views/posts/_plain.html.erb"

    def transform
      ->(css, scope:) { "#{css.strip}/* #{scope} */" }
    end

    def collector(**overrides)
      Herb::Engine::ScopedStyle::Collector.new(transform: transform, project_path: PROJECT_PATH, escape: false, **overrides)
    end

    test "derives the scope a compile of the same file derives" do
      visitor = Herb::Engine::ScopedStyle::Visitor.new(transform: transform)

      Herb::Engine.new(
        File.read(CARD),
        filename: "app/views/posts/_card.html.erb",
        project_path: PROJECT_PATH,
        escape: false,
        visitors: [visitor]
      )

      collected = collector
      collected.add(CARD)

      assert_equal visitor.styles.keys, collected.styles.keys
    end

    test "answers the scopes a file contributed" do
      collected = collector

      assert_equal 1, collected.add(CARD).length
      assert_empty collected.add(PLAIN)
    end

    test "keeps the CSS every file it was given scoped" do
      collected = collector
      collected.add(CARD)

      scope = collected.styles.keys.first

      assert_equal ".title { color: blue; }/* :where([#{scope}], [#{scope}] *) */", collected.to_css
    end

    test "records which scopes came from which file" do
      collected = collector
      collected.add(CARD)
      collected.add(PLAIN)

      assert_equal [CARD, PLAIN], collected.files.keys
      assert_empty collected.files.fetch(PLAIN)
    end

    test "keeps the CSS a scope was first given" do
      collected = collector
      collected.add(CARD)
      collected.add(CARD)

      assert_equal 1, collected.styles.length
    end

    test "is empty until something it was given has a scoped block" do
      collected = collector

      assert_predicate collected, :empty?

      collected.add(PLAIN)

      assert_predicate collected, :empty?

      collected.add(CARD)

      refute_predicate collected, :empty?
    end

    test "reports a file it could not compile and carries on" do
      collected = collector

      assert_empty collected.add("#{PROJECT_PATH}/app/views/posts/missing.html.erb")
      collected.add(CARD)

      assert_equal 1, collected.failures.length
      assert_equal Errno::ENOENT, collected.failures.first.error.class
      assert_equal 1, collected.styles.length
    end

    test "takes source it was handed, for a file it should not read" do
      collected = collector
      scopes = collected.add(CARD, %(<style scoped>.given { color: red; }</style><h1 class="given">Hi</h1>))

      scope = scopes.first

      assert_equal 1, scopes.length
      assert_equal ".given { color: red; }/* :where([#{scope}], [#{scope}] *) */", collected.to_css
    end

    test "prints what it gathered" do
      collected = collector
      collected.add(CARD)

      assert_equal "#<Herb::Engine::ScopedStyle::Collector scopes=1 files=1 failures=0>", collected.inspect
    end
  end
end
