import { expect } from "vitest"
import { spawn } from "child_process"

export type ExecResult = {
  stdout: string
  stderr: string
  exitCode: number
}

export const expectExitCode = (result: ExecResult, expectedCode: number) => {
  if (result.exitCode !== expectedCode) {
    const errorInfo = {
      expectedExitCode: expectedCode,
      actualExitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr
    }

    expect.fail(`Exit code mismatch:\n${JSON.stringify(errorInfo, null, 2)}`)
  }
}

export const execBinary = (args: string[] = [], input?: string): Promise<ExecResult> => {
  return new Promise((resolve) => {
    const child = spawn("node", ["bin/herb-format", ...args], {
      stdio: ["pipe", "pipe", "pipe"]
    })

    let stdout = ""
    let stderr = ""

    const timeout = setTimeout(() => {
      child.kill()
      resolve({ stdout, stderr, exitCode: 1 })
    }, 5000)

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      clearTimeout(timeout)
      resolve({ stdout, stderr, exitCode: code || 0 })
    })

    if (input) {
      child.stdin.write(input)
    }

    child.stdin.end()
  })
}
