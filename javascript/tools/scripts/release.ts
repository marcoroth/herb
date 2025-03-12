import { releaseVersion, releaseChangelog, releasePublish } from "nx/release"
import * as yargs from "yargs"

import { exec, ExecException } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const execute = async (command: string, taskName: string): Promise<string> => {
  try {
    console.log(`NOTE: running: ${command}`)

    const { stdout, stderr } = await execAsync(command)

    if (stderr) {
      console.error(`${taskName} stderr: ${stderr}`)
    }

    if (stdout) {
      console.log(`${taskName} stdout: ${stdout}`)
    }

    return stdout
  } catch (error) {
    const execError = error as ExecException
    console.error(`Error executing ${taskName}: ${execError.message}`)
    console.error(`Exit code: ${execError.code}`)

    if (execError.stderr) {
      console.error(`stderr: ${execError.stderr}`)
    }

    process.exit(execError.code || 1)
  }
}

const release = async () => {
  const options = await yargs
    .version(false) // don't use the default meaning of version in yargs
    .option("version", {
      description:
        "Explicit version specifier to use, if overriding conventional commits",
      type: "string",
    })
    .option("dryRun", {
      alias: "d",
      description:
        "Whether or not to perform a dry-run of the release process, defaults to true",
      type: "boolean",
      default: true,
    })
    .option("verbose", {
      description:
        "Whether or not to enable verbose logging, defaults to false",
      type: "boolean",
      default: false,
    })
    .option("firstRelease", {
      description: "Whether or not this is the first release of the project",
      type: "boolean",
      default: false,
    })
    .parseAsync()

  const { workspaceVersion, projectsVersionData } = await releaseVersion({
    specifier: options.version,
    dryRun: options.dryRun,
    verbose: options.verbose,
    firstRelease: options.firstRelease,
  })

  await execute(
    `bundle exec rake version:set[${workspaceVersion},${options.dryRun}]`,
    "Rake task",
  )

  if (!options.dryRun) {
    await execute(
      `git commit -m "Bump Ruby and C version to \`${workspaceVersion}\`"`,
      "Git commit",
    )
  } else {
    console.log(
      `DRY RUN: Would commit additional files for version ${workspaceVersion}`,
    )
  }

  await execute("bundle exec rake templates", "Rake Templates")
  await execute("make clean", "Make Clean")
  await execute("make", "Make")
  await execute("nx run-many --target=build --all", "Nx Build")
  await execute("nx run-many --target=test --all", "Nx Build")

  await releaseChangelog({
    versionData: projectsVersionData,
    version: workspaceVersion,
    dryRun: options.dryRun,
    verbose: options.verbose,
    firstRelease: options.firstRelease,
  })

  const publishResults = await releasePublish({
    dryRun: options.dryRun,
    verbose: options.verbose,
  })

  process.exit(
    Object.values(publishResults).every((result) => result.code === 0) ? 0 : 1,
  )
}

release()
