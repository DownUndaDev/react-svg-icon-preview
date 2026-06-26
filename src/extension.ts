/**
 * React SVG Preview Extension
 *
 * A VS Code extension that provides inline preview and hover preview
 * for React SVG icon components.
 */

import * as vscode from 'vscode'
import {
  createDecorationProvider,
  clearDecorations,
} from './provider/decorationProvider'
import {
  createHoverProvider,
  clearComponentCache,
  updateComponentCache,
} from './provider/hoverProvider'
import { parseSvgComponents } from './svgParser'

let decorationProvider: ReturnType<typeof createDecorationProvider> | undefined

/**
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('React SVG Preview extension is now active')

  // Create decoration provider
  decorationProvider = createDecorationProvider(context)

  // Create hover provider
  createHoverProvider(context)

  // Register toggle command
  const toggleCommand = vscode.commands.registerCommand(
    'reactSvgPreview.toggle',
    async () => {
      const config = vscode.workspace.getConfiguration('reactSvgPreview')
      const currentValue = config.get<boolean>('enabled', true)
      await config.update('enabled', !currentValue, vscode.ConfigurationTarget.Global)

      if (!currentValue) {
        // Re-enable: update decorations
        if (vscode.window.activeTextEditor) {
          decorationProvider?.update(vscode.window.activeTextEditor)
        }
        vscode.window.showInformationMessage('React SVG Preview enabled')
      } else {
        // Disable: clear decorations
        clearDecorations()
        clearComponentCache()
        vscode.window.showInformationMessage('React SVG Preview disabled')
      }
    }
  )

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'reactSvgPreview.refresh',
    () => {
      clearDecorations()
      clearComponentCache()

      if (vscode.window.activeTextEditor) {
        const components = decorationProvider?.update(vscode.window.activeTextEditor)
        if (components) {
          updateComponentCache(vscode.window.activeTextEditor.document, components)
        }
        vscode.window.showInformationMessage(
          `React SVG Preview: Found ${components?.length ?? 0} SVG components`
        )
      }
    }
  )

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration('reactSvgPreview')) {
        clearDecorations()
        clearComponentCache()

        if (vscode.window.activeTextEditor) {
          const components = decorationProvider?.update(vscode.window.activeTextEditor)
          if (components) {
            updateComponentCache(vscode.window.activeTextEditor.document, components)
          }
        }
      }
    }
  )

  context.subscriptions.push(toggleCommand, refreshCommand, configChangeListener)

  // Initial scan if there's an active editor
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor
    if (isSupportedLanguage(editor.document.languageId)) {
      const components = decorationProvider.update(editor)
      updateComponentCache(editor.document, components)
    }
  }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate(): void {
  console.log('React SVG Preview extension is now deactivated')
  decorationProvider?.dispose()
  clearDecorations()
  clearComponentCache()
}

/**
 * Check if the language is supported
 */
function isSupportedLanguage(languageId: string): boolean {
  return ['typescriptreact', 'javascriptreact', 'typescript', 'javascript', 'xml', 'svg'].includes(
    languageId
  )
}
