import { OnTypeFormattingProvider } from "@herb-tools/language-service"

import type {
  DocumentOnTypeFormattingOptions,
  DocumentOnTypeFormattingParams,
  TextEdit,
} from "vscode-languageserver/node"
import type { Documents } from "./documents"

export const ON_TYPE_FORMATTING_OPTIONS: DocumentOnTypeFormattingOptions = {
  firstTriggerCharacter: ">",
}

const provider = new OnTypeFormattingProvider()

export function handleOnTypeFormatting(
  documents: Documents,
  params: DocumentOnTypeFormattingParams,
): TextEdit[] {
  const document = documents.get(params.textDocument.uri)
  if (!document) return []

  return provider.getTextEdits(document, params.position, params.ch)
}
