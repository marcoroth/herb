import { $ } from 'bun'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageJson = JSON.parse(readFileSync(resolve(import.meta.dir, '../package.json'), 'utf-8'))
const version = packageJson.version

async function buildForPlatform(triple: string, outfile: string) {
  console.log(`Building for ${triple}...`)

  for (let i = 0; i < 5; ++i) {
    try {
      let cmd = $`bun build --compile --target=${triple} ./src/index.ts --outfile=${outfile} --env inline --define __VERSION__=${JSON.stringify(version)}`

      cmd = cmd.env({
        PLATFORM_LIBC: triple.includes('-musl') ? 'musl' : 'glibc',
      })

      await cmd
      console.log(`✓ Built ${outfile}`)
      return
    } catch (err) {
      if (i < 4) {
        console.log(`  Retry ${i + 1}/5 for ${triple}`)
        continue
      }
      throw new Error(`Failed to build for platform ${triple}`, { cause: err })
    }
  }
}

function sha256(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

async function main() {
  await mkdir('dist', { recursive: true })

  const builds = [
    ['bun-linux-arm64', './dist/herb-linux-arm64'],
    ['bun-linux-arm64-musl', './dist/herb-linux-arm64-musl'],
    ['bun-linux-x64-baseline', './dist/herb-linux-x64'],
    ['bun-linux-x64-musl-baseline', './dist/herb-linux-x64-musl'],
    ['bun-darwin-arm64', './dist/herb-macos-arm64'],
    ['bun-darwin-x64-baseline', './dist/herb-macos-x64'],
    ['bun-windows-x64-baseline', './dist/herb-windows-x64.exe'],
  ] as const

  await Promise.all(
    builds.map(([triple, outfile]) => buildForPlatform(triple, outfile))
  )

  console.log('\nGenerating checksums...')
  const sums: string[] = []

  for (const [, outfile] of builds) {
    const hash = sha256(outfile)
    const filename = outfile.split('/').pop()!
    sums.push(`${hash}  ${filename}`)
    console.log(`  ${filename}: ${hash}`)
  }

  const sumsFile = resolve('dist', 'SHA256SUMS')
  await writeFile(sumsFile, sums.join('\n') + '\n')
  console.log(`\n✓ Checksums written to ${sumsFile}`)

  console.log('\n✓ All builds completed successfully')
}

main().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
