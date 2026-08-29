# frozen_string_literal: true

require_relative "test_helper"

class SourcePathTest < Minitest::Spec
  PATH = "app/views/posts/_card.html.erb"

  def build(**)
    Herb::SourcePath.new(PATH, **)
  end

  describe "writing one out" do
    test "leaves a path that points nowhere in particular alone" do
      assert_equal PATH, build.to_s
    end

    test "writes a line on its own" do
      assert_equal "#{PATH}:8", build(line: 8).to_s
    end

    test "writes the column one further along than the parser reports" do
      assert_equal "#{PATH}:8:3", build(line: 8, column: 2).to_s
    end

    test "writes the first column as one" do
      assert_equal "#{PATH}:8:1", build(line: 8, column: 0).to_s
    end

    test "leaves out a column that has no line to belong to" do
      assert_equal PATH, build(column: 2).to_s
    end

    test "writes a scheme as something an editor opens" do
      assert_equal "vscode://file/#{PATH}:8:3", build(line: 8, column: 2, scheme: "vscode").to_s
    end

    test "writes a scheme on a path that points nowhere in particular" do
      assert_equal "zed://file/#{PATH}", build(scheme: "zed").to_s
    end

    test "reads as a string wherever one is expected" do
      assert_equal "#{PATH}:8:3 ", "#{build(line: 8, column: 2)} "
    end
  end

  describe "reading one back" do
    test "reads a path that points nowhere in particular" do
      reference = Herb::SourcePath.parse(PATH)

      assert_equal PATH, reference.path.to_s
      assert_nil reference.line
      assert_nil reference.column
    end

    test "reads a line on its own" do
      reference = Herb::SourcePath.parse("#{PATH}:8")

      assert_equal 8, reference.line
      assert_nil reference.column
    end

    test "reads the column back the way the parser reports it" do
      reference = Herb::SourcePath.parse("#{PATH}:8:3")

      assert_equal 8, reference.line
      assert_equal 2, reference.column
    end

    test "reads a first column of one as the first column" do
      assert_equal 0, Herb::SourcePath.parse("#{PATH}:8:1").column
    end

    test "reads a column of zero as the first column, since nothing here writes one" do
      assert_equal 0, Herb::SourcePath.parse("#{PATH}:8:0").column
    end

    test "reads a scheme, and the path it names from the root" do
      reference = Herb::SourcePath.parse("vscode://file/#{PATH}:8:3")

      assert_equal "vscode", reference.scheme
      assert_equal "/#{PATH}", reference.path.to_s
      assert_equal 2, reference.column
    end

    test "keeps a drive letter as part of the path" do
      reference = Herb::SourcePath.parse("C:/views/index.html.erb:2:1")

      assert_equal "C:/views/index.html.erb", reference.path.to_s
      assert_equal 2, reference.line
    end

    test "answers with nothing for a string with no path in it" do
      assert_nil Herb::SourcePath.parse("")
    end

    test "round-trips everything it writes" do
      [PATH, "#{PATH}:8", "#{PATH}:8:3", "vscode://file/#{PATH}:8:3", "cursor://file/#{PATH}"].each do |string|
        assert_equal string, Herb::SourcePath.parse(string).to_s
      end
    end
  end

  describe ".at" do
    test "takes the position the parser reported" do
      reference = Herb::SourcePath.at(PATH, Herb::Position[8, 2])

      assert_equal "#{PATH}:8:3", reference.to_s
    end

    test "points nowhere in particular when there is no position" do
      assert_equal PATH, Herb::SourcePath.at(PATH, nil).to_s
    end

    test "carries a scheme through" do
      assert_equal "zed://file/#{PATH}:8:3", Herb::SourcePath.at(PATH, Herb::Position[8, 2], scheme: "zed").to_s
    end
  end

  describe "#position" do
    test "answers with the position the parser would report" do
      assert_equal Herb::Position[8, 2], build(line: 8, column: 2).position
    end

    test "answers with the first column when only a line is known" do
      assert_equal Herb::Position[8, 0], build(line: 8).position
    end

    test "answers with nothing when it points nowhere in particular" do
      assert_nil build.position
      refute_predicate build, :position?
    end

    test "round-trips a position" do
      position = Herb::Position[8, 2]

      assert_equal position, Herb::SourcePath.parse(Herb::SourcePath.at(PATH, position).to_s).position
    end
  end

  describe "changing one" do
    test "puts a scheme on one that was read back without it" do
      reference = Herb::SourcePath.parse("#{PATH}:8:3").with_scheme("vscode")

      assert_equal "vscode://file/#{PATH}:8:3", reference.to_s
    end

    test "takes a scheme back off" do
      assert_equal "#{PATH}:8:3", build(line: 8, column: 2, scheme: "vscode").with_scheme(nil).to_s
    end

    test "points at another file and keeps the position" do
      assert_equal "other.html.erb:8:3", build(line: 8, column: 2).with_path("other.html.erb").to_s
    end

    test "points somewhere else in the same file and keeps the scheme" do
      reference = build(line: 8, column: 2, scheme: "zed").with_position(Herb::Position[2, 0])

      assert_equal "zed://file/#{PATH}:2:1", reference.to_s
    end

    test "points nowhere in particular" do
      assert_equal PATH, build(line: 8, column: 2).with_position(nil).to_s
    end
  end

  describe "a path and a Pathname" do
    test "are the same thing" do
      assert_equal build(line: 8).to_s, Herb::SourcePath.new(Pathname.new(PATH), line: 8).to_s
    end

    test "answer with a Pathname" do
      assert_equal Pathname.new(PATH), build.to_pathname
    end
  end

  describe "comparing two" do
    test "two that write the same string are equal" do
      assert_equal build(line: 8, column: 2), build(line: 8, column: 2)
    end

    test "two that write different strings are not" do
      refute_equal build(line: 8, column: 2), build(line: 8, column: 3)
    end

    test "two that are equal hash the same, so one can key a Hash" do
      counts = Hash.new(0)
      counts[build(line: 8, column: 2)] += 1
      counts[build(line: 8, column: 2)] += 1

      assert_equal({ build(line: 8, column: 2) => 2 }, counts)
    end
  end

  describe "a project" do
    def project
      "/Users/marco/blog"
    end

    def within_project(**options)
      Herb::SourcePath.new(PATH, project_path: project, line: 8, column: 2, **options)
    end

    test "writes the path it was handed, guessing neither form" do
      assert_equal "#{PATH}:8:3", within_project.to_s
    end

    test "writes one out in full" do
      assert_equal "#{project}/#{PATH}:8:3", within_project.absolute.to_s
    end

    test "writes one relative to the project it belongs to" do
      absolute = Herb::SourcePath.new("#{project}/#{PATH}", project_path: project, line: 8, column: 2)

      assert_equal "#{PATH}:8:3", absolute.relative.to_s
    end

    test "leaves an absolute path alone when asked for it in full" do
      absolute = Herb::SourcePath.new("#{project}/#{PATH}", project_path: project)

      assert_equal "#{project}/#{PATH}", absolute.absolute.to_s
      assert_predicate absolute, :absolute?
    end

    test "answers a path outside the project as the walk up and back down" do
      outside = Herb::SourcePath.new("/etc/passwd", project_path: project)

      assert_equal "../../../etc/passwd", outside.relative.to_s
    end

    test "leaves a path with no project unchanged either way" do
      reference = Herb::SourcePath.new(PATH, line: 8)

      assert_equal "#{PATH}:8", reference.relative.to_s
      assert_equal "#{PATH}:8", reference.absolute.to_s
    end

    test "carries the project through everything that changes one" do
      assert_equal project, within_project.with_scheme("zed").project_path.to_s
      assert_equal project, within_project.with_position(nil).project_path.to_s
      assert_equal project, within_project.with_path("other.erb").project_path.to_s
    end

    test "is read against a project after the fact" do
      absolute = Herb::SourcePath.parse("#{project}/#{PATH}:8:3", project_path: project)

      assert_equal "#{PATH}:8:3", absolute.relative.to_s
    end

    test "is put on one that was read back without it" do
      reference = Herb::SourcePath.parse("#{PATH}:8:3").with_project_path(project)

      assert_equal "#{project}/#{PATH}:8:3", reference.absolute.to_s
    end
  end

  describe "a scheme and a path" do
    test "names the file from the root, which is what an editor opens" do
      reference = Herb::SourcePath.new("/Users/marco/blog/x.erb", line: 8, column: 2, scheme: "vscode")

      assert_equal "vscode://file/Users/marco/blog/x.erb:8:3", reference.to_s
    end

    test "leads with a separator even when the path does not" do
      assert_equal "vscode://file/x.erb", Herb::SourcePath.new("x.erb", scheme: "vscode").to_s
    end

    test "round-trips one an editor would open" do
      string = "vscode://file/Users/marco/blog/x.erb:8:3"

      assert_equal string, Herb::SourcePath.parse(string).to_s
      assert_equal "/Users/marco/blog/x.erb", Herb::SourcePath.parse(string).path.to_s
    end
  end

  describe "inspect" do
    test "shows what it writes" do
      assert_equal "#<Herb::SourcePath #{PATH}:8:3>", build(line: 8, column: 2).inspect
    end
  end
end
