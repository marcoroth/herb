import { describe, test, expect } from "vitest"

import { SourcePath } from "../src/source-path.js"
import { Position } from "../src/position.js"

const PATH = "app/views/posts/_card.html.erb"

const build = (options: ConstructorParameters<typeof SourcePath>[1] = {}) => new SourcePath(PATH, options)

describe("SourcePath", () => {
  describe("writing one out", () => {
    test("leaves a path that points nowhere in particular alone", () => {
      expect(build().toString()).toBe(PATH)
    })

    test("writes a line on its own", () => {
      expect(build({ line: 8 }).toString()).toBe(`${PATH}:8`)
    })

    test("writes the column one further along than the parser reports", () => {
      expect(build({ line: 8, column: 2 }).toString()).toBe(`${PATH}:8:3`)
    })

    test("writes the first column as one", () => {
      expect(build({ line: 8, column: 0 }).toString()).toBe(`${PATH}:8:1`)
    })

    test("leaves out a column that has no line to belong to", () => {
      expect(build({ column: 2 }).toString()).toBe(PATH)
    })

    test("writes a scheme as something an editor opens", () => {
      expect(build({ line: 8, column: 2, scheme: "vscode" }).toString()).toBe(`vscode://file/${PATH}:8:3`)
    })
  })

  describe("reading one back", () => {
    test("reads the column back the way the parser reports it", () => {
      const reference = SourcePath.parse(`${PATH}:8:3`)!

      expect(reference.line).toBe(8)
      expect(reference.column).toBe(2)
    })

    test("reads a line on its own", () => {
      const reference = SourcePath.parse(`${PATH}:8`)!

      expect(reference.line).toBe(8)
      expect(reference.column).toBeNull()
    })

    test("reads a column of zero as the first column, since nothing here writes one", () => {
      expect(SourcePath.parse(`${PATH}:8:0`)!.column).toBe(0)
    })

    test("reads a scheme, and the path it names from the root", () => {
      const reference = SourcePath.parse(`vscode://file/${PATH}:8:3`)!

      expect(reference.scheme).toBe("vscode")
      expect(reference.path).toBe(`/${PATH}`)
    })

    test("keeps a drive letter as part of the path", () => {
      const reference = SourcePath.parse("C:/views/index.html.erb:2:1")!

      expect(reference.path).toBe("C:/views/index.html.erb")
      expect(reference.line).toBe(2)
    })

    test("answers with nothing for a string with no path in it", () => {
      expect(SourcePath.parse("")).toBeNull()
    })

    test("round-trips everything it writes", () => {
      for (const string of [PATH, `${PATH}:8`, `${PATH}:8:3`, `vscode://file/${PATH}:8:3`, `cursor://file/${PATH}`]) {
        expect(SourcePath.parse(string)!.toString()).toBe(string)
      }
    })
  })

  describe("at and position", () => {
    test("takes the position the parser reported", () => {
      expect(SourcePath.at(PATH, Position.from(8, 2)).toString()).toBe(`${PATH}:8:3`)
    })

    test("points nowhere in particular when there is no position", () => {
      expect(SourcePath.at(PATH, null).toString()).toBe(PATH)
      expect(SourcePath.at(PATH, null).hasPosition).toBe(false)
    })

    test("round-trips a position", () => {
      const position = Position.from(8, 2)
      const back = SourcePath.parse(SourcePath.at(PATH, position).toString())!.position!

      expect(back.line).toBe(8)
      expect(back.column).toBe(2)
    })

    test("answers with the first column when only a line is known", () => {
      expect(build({ line: 8 }).position!.column).toBe(0)
    })
  })

  describe("changing one", () => {
    test("puts a scheme on one that was read back without it", () => {
      expect(SourcePath.parse(`${PATH}:8:3`)!.withScheme("vscode").toString()).toBe(`vscode://file/${PATH}:8:3`)
    })

    test("takes a scheme back off", () => {
      expect(build({ line: 8, column: 2, scheme: "vscode" }).withScheme(null).toString()).toBe(`${PATH}:8:3`)
    })

    test("points at another file and keeps the position", () => {
      expect(build({ line: 8, column: 2 }).withPath("other.html.erb").toString()).toBe("other.html.erb:8:3")
    })

    test("points somewhere else in the same file and keeps the scheme", () => {
      const reference = build({ line: 8, column: 2, scheme: "zed" }).withPosition(Position.from(2, 0))

      expect(reference.toString()).toBe(`zed://file/${PATH}:2:1`)
    })

    test("points nowhere in particular", () => {
      expect(build({ line: 8, column: 2 }).withPosition(null).toString()).toBe(PATH)
    })
  })

  describe("comparing two", () => {
    test("two that write the same string are equal", () => {
      expect(build({ line: 8, column: 2 }).equals(build({ line: 8, column: 2 }))).toBe(true)
      expect(build({ line: 8, column: 2 }).equals(build({ line: 8, column: 3 }))).toBe(false)
    })
  })

  describe("a project", () => {
    const PROJECT = "/Users/marco/blog"

    const withinProject = () => new SourcePath(PATH, { projectPath: PROJECT, line: 8, column: 2 })

    test("writes the path it was handed, guessing neither form", () => {
      expect(withinProject().toString()).toBe(`${PATH}:8:3`)
    })

    test("writes one out in full", () => {
      expect(withinProject().absolute.toString()).toBe(`${PROJECT}/${PATH}:8:3`)
    })

    test("writes one relative to the project it belongs to", () => {
      const absolute = new SourcePath(`${PROJECT}/${PATH}`, { projectPath: PROJECT, line: 8, column: 2 })

      expect(absolute.relative.toString()).toBe(`${PATH}:8:3`)
    })

    test("leaves an absolute path alone when asked for it in full", () => {
      const absolute = new SourcePath(`${PROJECT}/${PATH}`, { projectPath: PROJECT })

      expect(absolute.absolute.toString()).toBe(`${PROJECT}/${PATH}`)
      expect(absolute.isAbsolute).toBe(true)
    })

    test("answers a path outside the project as the walk up and back down", () => {
      const outside = new SourcePath("/etc/passwd", { projectPath: PROJECT })

      expect(outside.relative.toString()).toBe("../../../etc/passwd")
    })

    test("leaves a path with no project unchanged either way", () => {
      const reference = new SourcePath(PATH, { line: 8 })

      expect(reference.relative.toString()).toBe(`${PATH}:8`)
      expect(reference.absolute.toString()).toBe(`${PATH}:8`)
    })

    test("carries the project through everything that changes one", () => {
      expect(withinProject().withScheme("zed").projectPath).toBe(PROJECT)
      expect(withinProject().withPosition(null).projectPath).toBe(PROJECT)
      expect(withinProject().withPath("other.erb").projectPath).toBe(PROJECT)
    })

    test("is read against a project after the fact", () => {
      const absolute = SourcePath.parse(`${PROJECT}/${PATH}:8:3`, PROJECT)!

      expect(absolute.relative.toString()).toBe(`${PATH}:8:3`)
    })

    test("is put on one that was read back without it", () => {
      const reference = SourcePath.parse(`${PATH}:8:3`)!.withProjectPath(PROJECT)

      expect(reference.absolute.toString()).toBe(`${PROJECT}/${PATH}:8:3`)
    })
  })

  describe("a scheme and a path", () => {
    test("names the file from the root, which is what an editor opens", () => {
      const reference = new SourcePath("/Users/marco/blog/x.erb", { line: 8, column: 2, scheme: "vscode" })

      expect(reference.toString()).toBe("vscode://file/Users/marco/blog/x.erb:8:3")
    })

    test("leads with a separator even when the path does not", () => {
      expect(new SourcePath("x.erb", { scheme: "vscode" }).toString()).toBe("vscode://file/x.erb")
    })

    test("round-trips one an editor would open", () => {
      const string = "vscode://file/Users/marco/blog/x.erb:8:3"

      expect(SourcePath.parse(string)!.toString()).toBe(string)
      expect(SourcePath.parse(string)!.path).toBe("/Users/marco/blog/x.erb")
    })
  })
})
