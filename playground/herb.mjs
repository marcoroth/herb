import { spawn } from 'child_process'
import { writeFile, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

async function executeCommand (command, args = []) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args, {
      cwd: process.cwd() || '/',
      shell: true
    })

    let stdout = ''
    let stderr = ''

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve({
          stdout,
          stderr,
          code
        })
      } else {
        reject({
          stdout,
          stderr,
          code
        })
      }
    })

    childProcess.on('error', (error) => {
      reject({
        error,
        stderr,
        stdout,
        code: 1
      })
    })
  })
}

export async function parse (sourceCode, herbExecutablePath = '../exe/herb') {
  let stringResult
  // let jsonResult

  try {
    const tempDir = await mkdtemp(join(tmpdir(), 'herb-'))
    const tempFilePath = join(tempDir, 'source.html.erb')

    await writeFile(tempFilePath, sourceCode, 'utf8')
    console.log(`Source code written to: ${tempFilePath}`)

    stringResult = await executeCommand(herbExecutablePath, ['parse', tempFilePath])
    // jsonResult = await executeCommand(herbExecutablePath, ['parse', tempFilePath, "--json"])

    return {
      string: stringResult.stdout
      // json: JSON.parse(jsonResult.stdout)
    }
  } catch (error) {
    console.error('Parsing failed:', error.code)
    console.error('STDERR:', error.stderr)
    console.error('STDOUT:', error.stdout)

    if (error.error) {
      console.error('ERROR:', error.error.message)
    }

    return {
      string: stringResult?.stderr || 'Parsing failed'
      // json: jsonResult?.stderr || { error: 'Parsing failed' },
    }
  }
}
