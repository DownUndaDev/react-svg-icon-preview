/**
 * Decoration Provider - Show inline SVG icons in the editor gutter
 */

import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { ParsedSvgComponent, parseSvgComponents, parseRawSvgFile, isRawSvgContent } from '../svgParser'

// Store decoration types for cleanup
const decorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map()

// Store temp file paths for each component (shared with hoverProvider)
const tempFilePaths: Map<string, string> = new Map()

// Temp directory for storing SVG files (needed for gutter icons)
const tempDir = path.join(os.tmpdir(), 'react-svg-preview')

/**
 * Get temp file path for a component
 * Key format: "documentUri:componentName"
 */
export function getTempFilePath(documentUri: string, componentName: string): string | undefined {
  return tempFilePaths.get(`${documentUri}:${componentName}`)
}

/**
 * Ensure temp directory exists
 */
function ensureTempDir(): void {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
}

/**
 * Create a temp SVG file and return its path
 */
function createTempSvgFile(svg: string, name: string): string {
  ensureTempDir()
  const filePath = path.join(tempDir, `${name}-${Date.now()}.svg`)
  fs.writeFileSync(filePath, svg)
  return filePath
}

/**
 * Clean up old temp files
 */
function cleanupTempFiles(): void {
  if (!fs.existsSync(tempDir)) {
    return
  }

  const files = fs.readdirSync(tempDir)
  const now = Date.now()
  const maxAge = 1000 * 60 * 60 // 1 hour

  for (const file of files) {
    const filePath = path.join(tempDir, file)
    try {
      const stats = fs.statSync(filePath)
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath)
      }
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Clear all decorations
 */
export function clearDecorations(): void {
  for (const decorationType of decorationTypes.values()) {
    decorationType.dispose()
  }
  decorationTypes.clear()
}

/**
 * Update decorations for a text editor
 */
export function updateDecorations(
  editor: vscode.TextEditor,
  config: {
    enabled: boolean
    showInlineIcon: boolean
    iconSize: number
    defaultFillColor: string
  }
): ParsedSvgComponent[] {
  // Clear existing decorations for this editor
  const editorKey = editor.document.uri.toString()
  const existingDecoration = decorationTypes.get(editorKey)
  if (existingDecoration) {
    existingDecoration.dispose()
    decorationTypes.delete(editorKey)
  }

  if (!config.enabled || !config.showInlineIcon) {
    return []
  }

  const text = editor.document.getText()
  const fileName = editor.document.fileName.split('/').pop() || 'unknown'
  
  // Check if this is a raw SVG file
  let components: ParsedSvgComponent[]
  if (isRawSvgContent(text) || fileName.endsWith('.svg')) {
    components = parseRawSvgFile(text, fileName)
  } else {
    components = parseSvgComponents(text, {
      defaultFillColor: config.defaultFillColor,
    })
  }

  if (components.length === 0) {
    return components
  }

  // Clean up old temp files periodically
  cleanupTempFiles()

  // Create decorations for each component
  for (const component of components) {
    try {
      // Create temp SVG file for gutter icon
      const svgPath = createTempSvgFile(component.svg, component.name)

      // Store temp file path for hover provider to use
      const componentKey = `${editorKey}:${component.name}`
      tempFilePaths.set(componentKey, svgPath)

      // Create decoration type with gutter icon
      const decorationType = vscode.window.createTextEditorDecorationType({
        gutterIconPath: vscode.Uri.file(svgPath),
        gutterIconSize: `${config.iconSize}px`,
      })

      // Store for cleanup
      const existingComponentDecoration = decorationTypes.get(componentKey)
      if (existingComponentDecoration) {
        existingComponentDecoration.dispose()
      }
      decorationTypes.set(componentKey, decorationType)

      // Apply decoration to the component's start line
      const range = new vscode.Range(
        new vscode.Position(component.startLine, 0),
        new vscode.Position(component.startLine, 0)
      )

      editor.setDecorations(decorationType, [{ range }])
    } catch (error) {
      console.error(`Failed to create decoration for ${component.name}:`, error)
    }
  }

  return components
}

/**
 * Create a decoration provider that updates on document changes
 */
export function createDecorationProvider(context: vscode.ExtensionContext): {
  update: (editor: vscode.TextEditor) => ParsedSvgComponent[]
  dispose: () => void
} {
  let timeout: NodeJS.Timeout | undefined
  let cachedComponents: Map<string, ParsedSvgComponent[]> = new Map()

  const getConfig = () => {
    const config = vscode.workspace.getConfiguration('reactSvgPreview')
    return {
      enabled: config.get<boolean>('enabled', true),
      showInlineIcon: config.get<boolean>('showInlineIcon', true),
      iconSize: config.get<number>('iconSize', 16),
      defaultFillColor: config.get<string>('defaultFillColor', '#888888'),
    }
  }

  const update = (editor: vscode.TextEditor): ParsedSvgComponent[] => {
    const config = getConfig()
    const components = updateDecorations(editor, config)
    cachedComponents.set(editor.document.uri.toString(), components)
    return components
  }

  const triggerUpdate = (editor: vscode.TextEditor, throttle = false) => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = undefined
    }

    if (throttle) {
      timeout = setTimeout(() => update(editor), 500)
    } else {
      update(editor)
    }
  }

  // Update on active editor change
  const activeEditorListener = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (editor && isSupportedLanguage(editor.document.languageId)) {
        triggerUpdate(editor)
      }
    }
  )

  // Update on document change
  const documentChangeListener = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      const editor = vscode.window.activeTextEditor
      if (
        editor &&
        event.document === editor.document &&
        isSupportedLanguage(editor.document.languageId)
      ) {
        triggerUpdate(editor, true)
      }
    }
  )

  // Initial update
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor
    if (isSupportedLanguage(editor.document.languageId)) {
      triggerUpdate(editor)
    }
  }

  context.subscriptions.push(activeEditorListener, documentChangeListener)

  return {
    update,
    dispose: () => {
      clearDecorations()
      if (timeout) {
        clearTimeout(timeout)
      }
    },
  }
}

/**
 * Check if the language is supported
 */
function isSupportedLanguage(languageId: string): boolean {
  return ['typescriptreact', 'javascriptreact', 'typescript', 'javascript', 'xml', 'svg'].includes(
    languageId
  )
}

