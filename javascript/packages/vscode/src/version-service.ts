import * as vscode from 'vscode'

export interface VersionComponent {
  name: string
  version: string
}

export class VersionService {
  public extensionVersion: string
  public linterVersion: string
  public herbVersions: string = 'Not analyzed yet'

  constructor(context: vscode.ExtensionContext) {
    const packageJson = require(context.asAbsolutePath('package.json'))
    this.extensionVersion = packageJson.version

    try {
      const linterPackageJson = require('@herb-tools/linter/package.json')
      this.linterVersion = linterPackageJson.version
    } catch {
      this.linterVersion = 'Unknown'
    }
  }

  updateHerbVersions(versionString: string): void {
    this.herbVersions = versionString
  }

  parseHerbVersion(): VersionComponent[] {
    if (this.herbVersions === 'Loading...' || this.herbVersions === 'Error loading versions' || this.herbVersions === 'Not analyzed yet') {
      return [{ name: 'Herb Parser', version: this.herbVersions }]
    }

    const components: VersionComponent[] = []
    const parts = this.herbVersions.split(', ')

    for (const part of parts) {
      const trimmedPart = part.trim()
      const lastAtIndex = trimmedPart.lastIndexOf('@')

      if (lastAtIndex >= 0) {
        const name = trimmedPart.substring(0, lastAtIndex)
        const versionPart = trimmedPart.substring(lastAtIndex + 1)

        const spaceIndex = versionPart.indexOf(' ')
        const version = spaceIndex > 0 ? versionPart.substring(0, spaceIndex) : versionPart
        const suffix = spaceIndex > 0 ? versionPart.substring(spaceIndex).trim() : ''

        components.push({
          name: this.formatComponentName(name),
          version: suffix ? `v${version} ${suffix}` : `v${version}`
        })
      }
    }

    return components.length > 0 ? components : [{ name: 'Herb Parser', version: this.herbVersions }]
  }

  private formatComponentName(name: string): string {
    return name
  }
}
