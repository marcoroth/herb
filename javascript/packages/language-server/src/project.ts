export class Project {
  projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  async initialize() {}
  async refresh() {}
}
