# frozen_string_literal: true

require_relative "test_helper"
require "herb/engine/visitors/html_safe_assertions_visitor"
require "tmpdir"

class RactorTest < Minitest::Spec
  TEMPLATES = [
    %(<div class="<%= :a %>"><% if true %><%= "x" %><% end %><script>var a = 1;</script></div>\n),
    %(<ul>\n  <% items.each do |item| %>\n    <li><%= item %></li>\n  <% end %>\n</ul>\n),
    %(<%= link_to "Home", root_path, class: "nav" %>\n<style>p { color: red; }</style>\n),
    %(<p>\n  <%# comment %>\n  <%== raw_html %>\n</p>\n)
  ].map(&:freeze).freeze

  class ExperimentalVisitor < Herb::Visitor
    extend Herb::Visitor::Experimental

    experimental "The test visitor is experimental."
  end

  def setup
    skip "Herb supports Ractors on Ruby 4.0 and later" if Gem::Version.new(RUBY_VERSION) < Gem::Version.new("4.0")

    @experimental_warnings = Warning[:experimental]
    Warning[:experimental] = false

    Herb.configuration
  end

  def teardown
    Warning[:experimental] = @experimental_warnings unless @experimental_warnings.nil?
    Herb.reset_configuration!
  end

  def in_ractors(count = 4, &block)
    Array.new(count) { Ractor.new(&block) }.map(&:value)
  end

  test "parse, lex and extract run in several Ractors at once" do
    source = TEMPLATES.first
    expected = [Herb.parse(source).value.inspect, Herb.lex(source).value.map(&:inspect), Herb.extract_ruby(source), Herb.extract_html(source)]

    results = in_ractors do
      template = RactorTest::TEMPLATES.first

      [Herb.parse(template).value.inspect, Herb.lex(template).value.map(&:inspect), Herb.extract_ruby(template), Herb.extract_html(template)]
    end

    assert_equal [expected] * 4, results
  end

  test "Herb::Engine compiles the same source in several Ractors as on the main Ractor" do
    expected = TEMPLATES.map { |template| Herb::Engine.new(template, escape: true).src }

    results = in_ractors do
      RactorTest::TEMPLATES.map { |template| Herb::Engine.new(template, escape: true).src }
    end

    assert_equal [expected] * 4, results
  end

  test "Herb::Engine with a visitor that declares parser options compiles in a Ractor" do
    expected = Herb::Engine.new(TEMPLATES.first, visitors: [Herb::Engine::HTMLSafeAssertionsVisitor.new]).src

    result = Ractor.new do
      Herb::Engine.new(RactorTest::TEMPLATES.first, visitors: [Herb::Engine::HTMLSafeAssertionsVisitor.new]).src
    end.value

    assert_equal expected, result
  end

  test "an experimental visitor announces itself once per Ractor" do
    output = Ractor.new do
      $stderr = StringIO.new
      2.times { RactorTest::ExperimentalVisitor.new }
      $stderr.string
    end.value

    assert_equal "[Herb] The test visitor is experimental.\n", output
  end

  test "a Ractor can't load the configuration before the main Ractor did" do
    Herb.reset_configuration!

    error = assert_raises(Ractor::RemoteError) do
      Ractor.new do
        Thread.current.report_on_exception = false

        Herb.configuration
      end.value
    end

    assert_instance_of Ractor::IsolationError, error.cause
  end

  test "a configuration is shareable, including one built with merge" do
    Dir.mktmpdir("herb_ractor_test") do |directory|
      File.write(File.join(directory, ".herb.yml"), "base: &base\n  include: [a]\nlinter:\n  <<: *base\n")
      File.write(File.join(directory, "herb.yml"), "")

      capture_io { Herb.configure(directory) }
      configuration = Herb.configuration

      assert Ractor.shareable?(configuration)
      assert Ractor.shareable?(configuration.merge("linter" => { "include" => ["b"] }, "new" => [{ "key" => "value" }]))
    end
  end

  test "the default ERB openings and compile-path constants are shareable" do
    assert Ractor.shareable?(Herb.default_erb_openings)
    assert Ractor.shareable?(Herb::Configuration::OPTIONS)
    assert Ractor.shareable?(Herb::Configuration::DEFAULTS)
    assert Ractor.shareable?(Herb::Engine::Compiler::HORIZONTAL_SPACE)
    assert Ractor.shareable?(Herb::Engine::Compiler::RAW_TEXT_ELEMENTS)
  end
end
