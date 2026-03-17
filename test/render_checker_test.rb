# frozen_string_literal: true

require_relative "test_helper"
require_relative "../lib/herb/render_checker"
require "tmpdir"
require "fileutils"

class RenderCheckerTest < Minitest::Spec
  def create_project(files = {})
    directory = Dir.mktmpdir("herb-render-check-")

    files.each do |path, content|
      full_path = File.join(directory, path)
      FileUtils.mkdir_p(File.dirname(full_path))
      File.write(full_path, content)
    end

    directory
  end

  def check(directory)
    checker = Herb::RenderChecker.new(directory)
    checker.analyze
  end

  def teardown
    @directories_to_clean&.each { |directory| FileUtils.rm_rf(directory) }
  end

  def track_directory(directory)
    @directories_to_clean ||= []
    @directories_to_clean << directory
    directory
  end

  test "no issues when all render calls resolve" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/header" %>',
                                  "app/views/shared/_header.html.erb" => "<h1>Header</h1>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
    refute result.issues?
  end

  test "detects unresolved render call" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/missing" %>'
                                ))

    result = check(directory)

    assert_equal 1, result.unresolved.count
    assert_equal "shared/missing", result.unresolved.first[:partial]
  end

  test "detects unused partial" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => "<p>Hello</p>",
                                  "app/views/shared/_orphan.html.erb" => "<p>Orphan</p>"
                                ))

    result = check(directory)

    assert_equal 1, result.unused.count
    assert_includes result.unused.keys, "shared/orphan"
  end

  test "partial rendered from another partial is reachable" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/a" %>',
                                  "app/views/shared/_a.html.erb" => '<%= render "shared/b" %>',
                                  "app/views/shared/_b.html.erb" => "<p>Leaf</p>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "deep transitive chain is fully reachable" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/a" %>',
                                  "app/views/shared/_a.html.erb" => '<%= render "shared/b" %>',
                                  "app/views/shared/_b.html.erb" => '<%= render "shared/c" %>',
                                  "app/views/shared/_c.html.erb" => '<%= render "shared/d" %>',
                                  "app/views/shared/_d.html.erb" => "<p>Deep leaf</p>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "unreachable chain is entirely unused" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => "<p>No renders</p>",
                                  "app/views/shared/_orphan.html.erb" => '<%= render "shared/orphan_child" %>',
                                  "app/views/shared/_orphan_child.html.erb" => "<p>Child</p>"
                                ))

    result = check(directory)

    assert_equal 2, result.unused.count
    assert_includes result.unused.keys, "shared/orphan"
    assert_includes result.unused.keys, "shared/orphan_child"
  end

  test "partial only rendered from unreachable partial is unused" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/used" %>',
                                  "app/views/shared/_used.html.erb" => "<p>Used</p>",
                                  "app/views/shared/_unused_parent.html.erb" => '<%= render "shared/unused_child" %>',
                                  "app/views/shared/_unused_child.html.erb" => "<p>Child</p>"
                                ))

    result = check(directory)

    assert_equal 2, result.unused.count
    assert_includes result.unused.keys, "shared/unused_parent"
    assert_includes result.unused.keys, "shared/unused_child"
    refute_includes result.unused.keys, "shared/used"
  end

  test "multiple entry points can reach different partials" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/header" %>',
                                  "app/views/pages/about.html.erb" => '<%= render "shared/footer" %>',
                                  "app/views/shared/_header.html.erb" => "<h1>Header</h1>",
                                  "app/views/shared/_footer.html.erb" => "<footer>Footer</footer>"
                                ))

    result = check(directory)

    assert_empty result.unused
  end

  test "partial reachable from one entry point but not another is still used" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/sidebar" %>',
                                  "app/views/pages/about.html.erb" => "<p>No sidebar here</p>",
                                  "app/views/shared/_sidebar.html.erb" => "<aside>Sidebar</aside>"
                                ))

    result = check(directory)

    assert_empty result.unused
  end

  test "resolves short partial name relative to calling file directory" do
    directory = track_directory(create_project(
                                  "app/views/posts/index.html.erb" => '<%= render "card" %>',
                                  "app/views/posts/_card.html.erb" => "<div>Card</div>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "resolves application/ fallback for short partial names" do
    directory = track_directory(create_project(
                                  "app/views/posts/index.html.erb" => '<%= render "toolbar" %>',
                                  "app/views/application/_toolbar.html.erb" => "<nav>Toolbar</nav>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "layout render with block is detected via regex fallback" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render layout: "shared/wrapper" do %>Content<% end %>',
                                  "app/views/shared/_wrapper.html.erb" => "<div><%= yield %></div>"
                                ))

    result = check(directory)

    assert_empty result.unused
  end

  test "dynamic prefix marks matching partials as reachable" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "providers/#{provider_name}" %>',
                                  "app/views/providers/_youtube.html.erb" => "<div>YouTube</div>",
                                  "app/views/providers/_vimeo.html.erb" => "<div>Vimeo</div>"
                                ))

    result = check(directory)

    assert_empty result.unused
  end

  test "dynamic render does not report unresolved" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "providers/#{name}" %>'
                                ))

    result = check(directory)

    assert_empty result.unresolved
  end

  test "render call from Ruby controller marks partial as reachable" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => "<p>Page</p>",
                                  "app/views/shared/_from_controller.html.erb" => "<p>From controller</p>",
                                  "app/controllers/pages_controller.rb" => 'render partial: "shared/from_controller"'
                                ))

    result = check(directory)

    refute_includes result.unused.keys, "shared/from_controller"
  end

  test "dynamic render from Ruby controller marks prefix partials as reachable" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => "<p>Page</p>",
                                  "app/views/cards/_basic.html.erb" => "<div>Basic</div>",
                                  "app/views/cards/_premium.html.erb" => "<div>Premium</div>",
                                  "app/controllers/pages_controller.rb" => 'render partial: "cards/#{card_type}"'
                                ))

    result = check(directory)

    refute_includes result.unused.keys, "cards/basic"
    refute_includes result.unused.keys, "cards/premium"
  end

  test "render in non-output ERB tag is detected via regex fallback" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<% content = render("shared/widget") %><%= content %>',
                                  "app/views/shared/_widget.html.erb" => "<div>Widget</div>"
                                ))

    result = check(directory)

    assert_empty result.unused
  end

  test "circular render references do not cause infinite loop" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/a" %>',
                                  "app/views/shared/_a.html.erb" => '<%= render "shared/b" %>',
                                  "app/views/shared/_b.html.erb" => '<%= render "shared/a" %>'
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "empty project has no issues" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => "<p>Hello</p>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "mixed resolved, unresolved, and unused" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/header" %><%= render "shared/missing" %>',
                                  "app/views/shared/_header.html.erb" => "<h1>Header</h1>",
                                  "app/views/shared/_unused.html.erb" => "<p>Never used</p>"
                                ))

    result = check(directory)

    assert_equal 1, result.unresolved.count
    assert_equal "shared/missing", result.unresolved.first[:partial]
    assert_equal 1, result.unused.count
    assert_includes result.unused.keys, "shared/unused"
  end

  test "resolves partials with various extensions" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/a" %><%= render "shared/b" %>',
                                  "app/views/shared/_a.html.erb" => "<p>ERB</p>",
                                  "app/views/shared/_b.turbo_stream.erb" => "<turbo-stream>B</turbo-stream>"
                                ))

    result = check(directory)

    assert_empty result.unresolved
    assert_empty result.unused
  end

  test "result tracks render call counts" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/a" %><%= render "shared/b" %>',
                                  "app/views/shared/_a.html.erb" => "<p>A</p>",
                                  "app/views/shared/_b.html.erb" => "<p>B</p>"
                                ))

    result = check(directory)

    assert_equal 2, result.render_calls.count
    assert_equal 2, result.partial_files.count
  end

  test "result issues? returns false when clean" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/header" %>',
                                  "app/views/shared/_header.html.erb" => "<h1>Header</h1>"
                                ))

    result = check(directory)

    refute result.issues?
  end

  test "result issues? returns true with unresolved" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => '<%= render "shared/missing" %>'
                                ))

    result = check(directory)

    assert result.issues?
  end

  test "result issues? returns true with unused" do
    directory = track_directory(create_project(
                                  "app/views/pages/index.html.erb" => "<p>Hello</p>",
                                  "app/views/shared/_orphan.html.erb" => "<p>Orphan</p>"
                                ))

    result = check(directory)

    assert result.issues?
  end
end
