# frozen_string_literal: true

require_relative "test_helper"

class OptInRequiresTest < Minitest::Spec
  OPT_IN = {
    "Herb::CLI" => "herb/cli",
    "Herb::Configuration" => "herb/configuration",
    "Herb::Project" => "herb/project",
    "Herb::HTML::Util" => "herb/html/util",
    "Herb::Engine" => "herb/engine",
    "Herb::Engine::Validators" => "herb/engine/validators",
    "Herb::Engine::Visitors::Debug" => "herb/engine/visitors/debug",
    "Herb::Engine::Visitors::Optimize" => "herb/engine/visitors/optimize",
    "Herb::Engine::Report::Middleware" => "herb/engine/report/middleware",
  }.freeze

  def in_fresh_process(script)
    lib = File.expand_path("../lib", __dir__)

    IO.popen([RbConfig.ruby, "-I#{lib}", "-e", script], err: [:child, :out], &:read).strip
  end

  OPT_IN.each do |constant, path|
    test "#{constant} is not loaded by requiring herb alone" do
      output = in_fresh_process(<<~RUBY)
        require "herb"
        print Object.const_defined?("#{constant}") ? "loaded" : "absent"
      RUBY

      assert_equal "absent", output
    end

    test "#{constant} is available after requiring #{path}" do
      output = in_fresh_process(<<~RUBY)
        require "herb"
        require "#{path}"
        print Object.const_defined?("#{constant}") ? "loaded" : "absent"
      RUBY

      assert_equal "loaded", output
    end
  end

  test "Herb::Diff is not loaded by requiring herb alone" do
    output = in_fresh_process(<<~RUBY)
      require "herb"
      print $LOADED_FEATURES.any? { |feature| feature.include?("/herb/diff") } ? "loaded" : "absent"
    RUBY

    assert_equal "absent", output
  end

  test "Herb.diff loads Herb::Diff on its own" do
    output = in_fresh_process(<<~RUBY)
      require "herb"
      result = Herb.diff("<div>Hello</div>", "<div>World</div>")
      print [result.class, result.operations.first.class].join(" ")
    RUBY

    assert_equal "Herb::Diff::Result Herb::Diff::Operation", output
  end

  test "lexing works with nothing but herb required" do
    output = in_fresh_process(<<~RUBY)
      require "herb"
      print Herb.lex("<div>Hi</div>").success? ? "lexed" : "no"
    RUBY

    assert_equal "lexed", output
  end

  test "parsing works with nothing but herb required" do
    output = in_fresh_process(<<~RUBY)
      require "herb"
      print Herb.parse("<div><%= user.name %></div>").success? ? "parsed" : "no"
    RUBY

    assert_equal "parsed", output
  end

  test "extracting works with nothing but herb required" do
    output = in_fresh_process(<<~RUBY)
      require "herb"
      print Herb.extract_ruby("<div><%= 1 %></div>").include?("1") ? "extracted" : "no"
    RUBY

    assert_equal "extracted", output
  end

  test "compiling works after requiring herb/engine" do
    output = in_fresh_process(<<~RUBY)
      require "herb"
      require "herb/engine"
      print Herb::Engine.new("<div>Hi</div>").src.include?("<div>Hi</div>") ? "compiled" : "no"
    RUBY

    assert_equal "compiled", output
  end
end
