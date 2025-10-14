import { readFileSync } from "fs"
import { resolve } from "path"

import { Project } from "stimulus-parser"
import { CLI as HerbLinterCLI, FileProcessor } from "@herb-tools/linter/cli"
import { Herb } from "@herb-tools/node-wasm"
import { colorize } from "@herb-tools/highlighter"

import { StimulusLinter } from "./linter.js"
import { defaultRules } from "./default-rules.js"

class StimulusFileProcessor extends FileProcessor {
  private stimulusProject?: Project
  private parentProcessor: FileProcessor

  constructor(parentProcessor: FileProcessor, stimulusProject?: Project) {
    super()
    this.parentProcessor = parentProcessor
    this.stimulusProject = stimulusProject
  }

  async processFiles(files: string[], formatOption: any = 'detailed', context?: any) {
    const lintStartTime = Date.now()

    const baseResults = await this.parentProcessor.processFiles(files, formatOption, context)

    const stimulusLinter = new StimulusLinter(Herb, defaultRules, this.stimulusProject)

    for (const filename of files) {
      const filePath = resolve(filename)
      const content = readFileSync(filePath, "utf-8")
      const result = stimulusLinter.lint(content, { fileName: filename, stimulusProject: this.stimulusProject })

      if (result.offenses.length > 0) {
        for (const offense of result.offenses) {
          baseResults.allOffenses.push({
            filename,
            offense: offense,
            content
          })

          const ruleData = baseResults.ruleOffenses.get(offense.rule) || { count: 0, files: new Set() }
          ruleData.count++
          ruleData.files.add(filename)
          baseResults.ruleOffenses.set(offense.rule, ruleData)
        }

        baseResults.totalErrors += result.errors
        baseResults.totalWarnings += result.warnings
      }
    }

    const usedControllers = new Set<string>()
    const controllerUsageStats = new Map<string, {
      actions: Set<string>,
      targets: Set<string>,
      values: Set<string>,
      classes: Set<string>,
      outlets: Set<string>
    }>()

    let templatesWithStimulus = 0

    for (const filename of files) {
      const filePath = resolve(filename)
      const content = readFileSync(filePath, "utf-8")
      const hasStimulus = this.trackControllerUsage(content, usedControllers, controllerUsageStats)

      if (hasStimulus) {
        templatesWithStimulus++
      }
    }

    const lintTime = Date.now() - lintStartTime
    const featureStats = this.calculateFeatureStats(this.stimulusProject, controllerUsageStats)
    const controllerCount = this.stimulusProject?.registeredControllers.length || 0

    return {
      ...baseResults,
      stimulusInfo: {
        projectType: this.detectProjectType(this.stimulusProject),
        controllerCount,
        usedControllerCount: usedControllers.size,
        unusedControllerCount: Math.max(0, controllerCount - usedControllers.size),
        projectInitTime: 0,
        lintTime,
        projectFound: !!this.stimulusProject,
        usedControllers: Array.from(usedControllers),
        controllerUsageStats,
        featureStats,
        templatesScanned: files.length,
        templatesWithStimulus,
        stimulusTemplatePercentage: files.length > 0 ? Math.round((templatesWithStimulus / files.length) * 100) : 0
      }
    }
  }

  private detectProjectType(stimulusProject?: Project): string {
    return stimulusProject?.applicationFile?.mode || "unknown"
  }

  private calculateFeatureStats(stimulusProject: Project | undefined, _controllerUsageStats: Map<string, any>): any {
    if (!stimulusProject) {
      return {
        targets: { total: 0, used: 0, unused: 0 },
        actions: { total: 0, used: 0, unused: 0 },
        values:  { total: 0, used: 0, unused: 0 },
        classes: { total: 0, used: 0, unused: 0 },
        outlets: { total: 0, used: 0, unused: 0 }
      }
    }

    let totalTargets = 0, usedTargets = 0
    let totalActions = 0, usedActions = 0
    let totalValues  = 0, usedValues  = 0
    let totalClasses = 0, usedClasses = 0
    let totalOutlets = 0, usedOutlets = 0

    return {
      targets: { total: totalTargets, used: usedTargets, unused: totalTargets - usedTargets },
      actions: { total: totalActions, used: usedActions, unused: totalActions - usedActions },
      values:  { total: totalValues,  used: usedValues,  unused: totalValues  - usedValues  },
      classes: { total: totalClasses, used: usedClasses, unused: totalClasses - usedClasses },
      outlets: { total: totalOutlets, used: usedOutlets, unused: totalOutlets - usedOutlets }
    }
  }

  private trackControllerUsage(_content: string, _usedControllers: Set<string>, _controllerUsageStats: Map<string, any>): boolean {
    // TODO
    return false
  }
}

export class CLI extends HerbLinterCLI {
  private stimulusProject?: Project

  constructor() {
    super()
  }

  protected async beforeProcess(): Promise<void> {
    let controllerCount = 0

    try {
      this.stimulusProject = new Project(this.projectPath)

      console.log(`Analyzing Stimulus Project at ${this.projectPath}...`)

      await this.stimulusProject.initialize()
      await this.stimulusProject.analyze()

      controllerCount = this.stimulusProject.registeredControllers.length
      console.log(`Found ${controllerCount} Stimulus controllers`)

      this.fileProcessor = new StimulusFileProcessor(this.fileProcessor, this.stimulusProject)
    } catch (error) {
      console.log("No Stimulus project found, running without controller validation")
      this.stimulusProject = undefined

      this.fileProcessor = new StimulusFileProcessor(this.fileProcessor, this.stimulusProject)
    }

    await super.beforeProcess()
  }

  protected async afterProcess(results: any, outputOptions: any): Promise<void> {
    this.displayStimulusSummary(results, outputOptions)
  }

  private displayStimulusSummary(results: any, outputOptions: any): void {
    if (outputOptions.formatOption === 'json') {
      return
    }

    const { stimulusInfo } = results

    if (!stimulusInfo) {
      return
    }

    const labelWidth = 20
    const pad = (label: string) => label.padEnd(labelWidth)

    console.log('\n' + ' '.repeat(1) + colorize('Stimulus Project Info:', 'bold'))

    if (stimulusInfo.projectFound) {
      console.log(`  ${colorize(pad('Project type'), 'gray')} ${colorize(stimulusInfo.projectType, 'cyan')}`)

      const { templatesScanned, templatesWithStimulus, stimulusTemplatePercentage } = stimulusInfo

      let templateText = ''

      if (templatesWithStimulus > 0) {
        templateText = `${colorize(colorize(`${templatesScanned} scanned`, 'cyan'), 'bold')} | ${colorize(colorize(`${templatesWithStimulus} with Stimulus`, 'green'), 'bold')} ${colorize(colorize(`(${stimulusTemplatePercentage}% coverage)`, 'gray'), 'dim')}`
      } else {
        templateText = `${colorize(colorize(`${templatesScanned} scanned`, 'cyan'), 'bold')} | ${colorize(colorize('0 with Stimulus', 'brightYellow'), 'bold')} ${colorize(colorize('(0% coverage)', 'gray'), 'dim')}`
      }

      console.log(`  ${colorize(pad('Templates'), 'gray')} ${templateText}`)

      const { controllerCount, usedControllerCount, unusedControllerCount } = stimulusInfo

      if (controllerCount > 0) {
        let controllerText = ''

        if (unusedControllerCount > 0) {
          controllerText = `${colorize(colorize(`${usedControllerCount} used`, 'green'), 'bold')} | ${colorize(colorize(`${unusedControllerCount} unused`, 'brightYellow'), 'bold')} ${colorize(colorize(`(${controllerCount} total)`, 'gray'), 'dim')}`
        } else {
          controllerText = `${colorize(colorize(`${usedControllerCount} used`, 'green'), 'bold')} | ${colorize(colorize('0 unused', 'green'), 'bold')} ${colorize(colorize(`(${controllerCount} total)`, 'gray'), 'dim')}`
        }

        console.log(`  ${colorize(pad('Controllers'), 'gray')} ${controllerText}`)
      } else {
        console.log(`  ${colorize(pad('Controllers'), 'gray')} ${colorize(colorize('0 controllers', 'brightYellow'), 'bold')}`)
      }
    } else {
      console.log(`  ${colorize(pad('Project type'), 'gray')} ${colorize(stimulusInfo.projectType, 'cyan')}`)

      const { templatesScanned, templatesWithStimulus, stimulusTemplatePercentage } = stimulusInfo

      let templateText = ''

      if (templatesWithStimulus > 0) {
        templateText = `${colorize(colorize(`${templatesScanned} scanned`, 'cyan'), 'bold')} | ${colorize(colorize(`${templatesWithStimulus} with Stimulus`, 'green'), 'bold')} ${colorize(colorize(`(${stimulusTemplatePercentage}% coverage)`, 'gray'), 'dim')}`
      } else {
        templateText = `${colorize(colorize(`${templatesScanned} scanned`, 'cyan'), 'bold')} | ${colorize(colorize('0 with Stimulus', 'brightYellow'), 'bold')} ${colorize(colorize('(0% coverage)', 'gray'), 'dim')}`
      }

      console.log(`  ${colorize(pad('Templates'), 'gray')} ${templateText}`)
      console.log(`  ${colorize(pad('Controllers'), 'gray')} ${colorize(colorize('No Stimulus project detected', 'brightYellow'), 'bold')}`)
    }

    if (stimulusInfo.controllerCount > 0) {
      this.displayFeatureUsage(stimulusInfo)
    }

    if (outputOptions.showTiming) {
      console.log(`  ${colorize(pad('Project analysis'), 'gray')} ${colorize(`${stimulusInfo.projectInitTime}ms`, 'cyan')}`)
      console.log(`  ${colorize(pad('Lint time'), 'gray')} ${colorize(`${stimulusInfo.lintTime}ms`, 'cyan')}`)
    }
  }

  private displayFeatureUsage(stimulusInfo: any): void {
    const { featureStats } = stimulusInfo

    if (!featureStats) return

    const labelWidth = 20
    const pad = (label: string) => label.padEnd(labelWidth)

    const features = [
      { name: 'Targets', stats: featureStats.targets },
      { name: 'Actions', stats: featureStats.actions },
      { name: 'Values', stats: featureStats.values },
      { name: 'Classes', stats: featureStats.classes },
      { name: 'Outlets', stats: featureStats.outlets }
    ]

    for (const feature of features) {
      const { name, stats } = feature

      let featureText = ''

      if (stats.unused > 0) {
        featureText = `${colorize(colorize(`${stats.used} used`, 'green'), 'bold')} | ${colorize(colorize(`${stats.unused} unused`, 'brightYellow'), 'bold')} ${colorize(colorize(`(${stats.total} total)`, 'gray'), 'dim')}`
      } else {
        featureText = `${colorize(colorize(`${stats.used} used`, 'green'), 'bold')} | ${colorize(colorize('0 unused', 'green'), 'bold')} ${colorize(colorize(`(${stats.total} total)`, 'gray'), 'dim')}`
      }

      console.log(`  ${colorize(pad(name), 'gray')} ${featureText}`)
    }
  }
}
