# frozen_string_literal: true

require "test_helper"
require "json"

class ThemeTest < Minitest::Test
  def test_lists_bundled_themes
    assert_includes Herb::Highlighter.theme_names, "onedark"
    assert_includes Herb::Highlighter.theme_names, "tokyo-night"
    assert_equal Herb::Highlighter.theme_names, Herb::Highlighter.themes
  end

  def test_default_theme_is_bundled
    assert Herb::Highlighter.bundled_theme?(Herb::Highlighter.default_theme)
    refute Herb::Highlighter.bundled_theme?("not-a-theme")
  end

  def test_every_bundled_theme_builds
    Herb::Highlighter.theme_names.each do |theme|
      highlighter = Herb::Highlighter.new(theme)

      assert_equal theme, highlighter.theme
      refute highlighter.custom_theme?
      assert_includes plain(highlighter.highlight(TestHelper::TEMPLATE)), "user.admin?"
    end
  end

  def test_defaults_to_the_default_theme
    assert_equal Herb::Highlighter.default_theme, Herb::Highlighter.new.theme
  end

  def test_raises_for_an_unknown_theme
    error = assert_raises(Herb::Highlighter::ThemeError) do
      Herb::Highlighter.new("not-a-theme")
    end

    assert_includes error.message, "not-a-theme"
  end

  def test_theme_error_is_an_error
    assert_operator Herb::Highlighter::ThemeError, :<, Herb::Highlighter::Error
  end

  def test_loads_a_custom_theme_from_a_path
    scheme = JSON.parse(File.read(bundled_theme_path("dracula")))

    Tempfile.create(["theme", ".json"]) do |file|
      file.write(JSON.generate(scheme))
      file.flush

      highlighter = Herb::Highlighter.new(file.path)

      assert highlighter.custom_theme?
      assert_includes plain(highlighter.highlight(TestHelper::TEMPLATE)), "user.admin?"
    end
  end

  def test_rejects_a_theme_file_missing_required_keys
    Tempfile.create(["theme", ".json"]) do |file|
      file.write(JSON.generate({ "TOKEN_IDENTIFIER" => "#ABB2BF" }))
      file.flush

      error = assert_raises(Herb::Highlighter::ThemeError) { Herb::Highlighter.new(file.path) }

      assert_includes error.message, "missing required properties"
    end
  end

  private

  def bundled_theme_path(name)
    File.expand_path("../../../javascript/packages/highlighter/themes/#{name}.json", __dir__)
  end
end
