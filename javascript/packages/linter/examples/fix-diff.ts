/**
 * Run with:
 *   npx tsx examples/linter-fix-diff.ts
 */

import dedent from "dedent"

import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Herb } from "@herb-tools/node-wasm"
import { FileProcessor } from "../src/cli/file-processor.js"
import { DetailedFormatter } from "../src/cli/formatters/detailed-formatter.js"

const SOURCE = dedent`
  <div id="gems">
    <img src="a.png">
    <SPAN class='card'>Hello</SPAN>
    <% @gems.each do |gem| %>
      <%= render partial: 'gem_card', locals: {gem: gem} %>
    <% end %>
  </div>
`

const main = async () => {
  await Herb.load()

  const directory = mkdtempSync(join(tmpdir(), "herb-fix-diff-"))
  const filename = "index.html.erb"

  writeFileSync(join(directory, filename), `${SOURCE}\n`, "utf-8")

  const processor = new FileProcessor()

  const result = await processor.processFiles([filename], "detailed", {
    projectPath: directory,
    showFixDiff: true,
  })

  const formatter = new DetailedFormatter("onedark", false, false, directory)

  await formatter.format(result.allOffenses, false)

  const previewed = result.allOffenses.filter(offense => offense.fixedContent).length

  console.log(`\n\x1b[90m${previewed} of ${result.allOffenses.length} offenses had an autocorrection to preview\x1b[0m\n`)
}

main()
