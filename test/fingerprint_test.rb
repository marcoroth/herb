# frozen_string_literal: true

require_relative "test_helper"

require "tempfile"
require "fileutils"

class FingerprintTest < Minitest::Spec
  after do
    Herb::Fingerprint.clear_cache
  end

  describe "hashing content" do
    test "is stable for the same bytes" do
      assert_equal Herb::Fingerprint.of("<div></div>"), Herb::Fingerprint.of("<div></div>")
    end

    test "moves when the bytes move" do
      refute_equal Herb::Fingerprint.of("<div></div>"), Herb::Fingerprint.of("<div></div> ")
    end

    test "says nothing about content it was not given" do
      assert_nil Herb::Fingerprint.of(nil)
      assert_nil Herb::Fingerprint.short(nil)
    end

    test "reads the same bytes whatever encoding they arrive in" do
      utf8 = "<div>café</div>"

      assert_equal Herb::Fingerprint.of(utf8), Herb::Fingerprint.of(utf8.dup.force_encoding(Encoding::ASCII_8BIT))
    end

    test "shortens to something that fits in a filename" do
      digest = Herb::Fingerprint.of("<div></div>")

      assert_equal 8, Herb::Fingerprint.short(digest).length
      assert digest.start_with?(Herb::Fingerprint.short(digest))
    end
  end

  describe "hashing a template" do
    test "ignores a byte order mark, since the toolchains disagree about whether it is there" do
      assert_equal Herb::Fingerprint.template("<div></div>"), Herb::Fingerprint.template("\xEF\xBB\xBF<div></div>".b)
    end

    test "keeps line endings, since rewriting them changes the file" do
      refute_equal Herb::Fingerprint.template("<div>\n</div>"), Herb::Fingerprint.template("<div>\r\n</div>")
    end

    test "leaves a byte order mark alone when hashing plain content" do
      refute_equal Herb::Fingerprint.of("<div></div>"), Herb::Fingerprint.of("\xEF\xBB\xBF<div></div>".b)
    end

    test "says nothing about a template it was not given" do
      assert_nil Herb::Fingerprint.template(nil)
    end
  end

  describe "hashing a file" do
    test "matches hashing the bytes in it" do
      Tempfile.create(["asset", ".js"]) do |file|
        file.write("console.log(1)")
        file.flush

        assert_equal Herb::Fingerprint.of("console.log(1)"), Herb::Fingerprint.file(file.path)
      end
    end

    test "hashes a template file the way it hashes template text" do
      Tempfile.create(["template", ".erb"]) do |file|
        file.write("\xEF\xBB\xBF<div></div>")
        file.flush

        assert_equal Herb::Fingerprint.template("<div></div>"), Herb::Fingerprint.template_file(file.path)
      end
    end

    test "says nothing about a file that is not there" do
      assert_nil Herb::Fingerprint.file("does/not/exist.js")
      assert_nil Herb::Fingerprint.template_file("does/not/exist.html.erb")
      assert_nil Herb::Fingerprint.file(nil)
    end

    test "re-reads a template once it changes" do
      Tempfile.create(["template", ".erb"]) do |file|
        file.write("<div></div>")
        file.flush

        first = Herb::Fingerprint.template_file(file.path)

        File.write(file.path, "<span></span>")
        FileUtils.touch(file.path, mtime: Time.now + 2)

        refute_equal first, Herb::Fingerprint.template_file(file.path)
      end
    end

    test "re-reads a watched file every time, since a watcher is asking whether it changed" do
      Tempfile.create(["asset", ".js"]) do |file|
        file.write("console.log(1)")
        file.flush

        first = Herb::Fingerprint.file(file.path)

        File.write(file.path, "console.log(2)")

        refute_equal first, Herb::Fingerprint.file(file.path)
      end
    end
  end
end
