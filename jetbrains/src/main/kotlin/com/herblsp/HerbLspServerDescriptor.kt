package com.herblsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.javascript.nodejs.interpreter.NodeJsInterpreterManager
import com.intellij.javascript.nodejs.interpreter.local.NodeJsLocalInterpreter
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerDescriptor
import java.io.File

class HerbLspServerDescriptor(project: Project) : LspServerDescriptor(project, "Herb") {
  override fun isSupportedFile(file: VirtualFile) = file.extension == "html.erb" || file.extension == "erb" || file.extension == "html"

  override fun createCommandLine() : GeneralCommandLine {
    val interpreter = NodeJsInterpreterManager.getInstance(project).getInterpreter(true)
    var path = System.getenv("PATH")

    if (interpreter != null && interpreter is NodeJsLocalInterpreter) {
      val nodePath = interpreter.referenceName
      val binDir = nodePath.substring(0, nodePath.lastIndexOfAny(charArrayOf('/', '\\')))

      path = binDir + File.pathSeparator + path
    }

    return GeneralCommandLine()
      .withExePath("npx")
      .withEnvironment("PATH", path)
      .withParameters("@herb-tools/language-server", "--stdio")
  }
}
