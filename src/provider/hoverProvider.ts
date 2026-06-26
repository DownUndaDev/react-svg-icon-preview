/**
 * Hover Provider - Show SVG preview on hover
 */

import * as vscode from 'vscode'
import { ParsedSvgComponent, parseSvgComponents, parseRawSvgFile, isRawSvgContent, findComponentAtLine } from '../svgParser'
import { getTempFilePath } from './decorationProvider'

// Cache parsed components per document
const componentCache: Map<string, ParsedSvgComponent[]> = new Map()

/**
 * Update the component cache for a document
 */
export function updateComponentCache(
  document: vscode.TextDocument,
  components: ParsedSvgComponent[]
): void {
  componentCache.set(document.uri.toString(), components)
}

/**
 * Get cached components for a document, or parse if not cached
 */
function getComponents(
  document: vscode.TextDocument,
  defaultFillColor: string
): ParsedSvgComponent[] {
  const uri = document.uri.toString()
  let components = componentCache.get(uri)

  if (!components) {
    const text = document.getText()
    const fileName = document.fileName.split('/').pop() || 'unknown'
    
    // Check if this is a raw SVG file
    if (isRawSvgContent(text) || fileName.endsWith('.svg')) {
      components = parseRawSvgFile(text, fileName)
    } else {
      components = parseSvgComponents(text, { defaultFillColor })
    }
    componentCache.set(uri, components)
  }

  return components
}

/**
 * Create the hover provider
 */
export function createHoverProvider(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const provider = vscode.languages.registerHoverProvider(
    [
      { language: 'typescriptreact', scheme: 'file' },
      { language: 'javascriptreact', scheme: 'file' },
      { language: 'typescript', scheme: 'file' },
      { language: 'javascript', scheme: 'file' },
      { language: 'xml', scheme: 'file' },
      { language: 'svg', scheme: 'file' },
    ],
    {
      provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
      ): vscode.ProviderResult<vscode.Hover> {
        const config = vscode.workspace.getConfiguration('reactSvgPreview')
        const enabled = config.get<boolean>('enabled', true)
        const showHoverPreview = config.get<boolean>('showHoverPreview', true)
        const hoverPreviewSize = config.get<number>('hoverPreviewSize', 128)
        const defaultFillColor = config.get<string>('defaultFillColor', '#888888')

        if (!enabled || !showHoverPreview) {
          return null
        }

        const components = getComponents(document, defaultFillColor)
        const line = position.line

        // Find component at the current line
        const component = findComponentAtLine(components, line)

        if (!component) {
          return null
        }

        // Create hover content with SVG preview
        const markdown = new vscode.MarkdownString()
        markdown.isTrusted = true
        markdown.supportHtml = true

        // Calculate preview dimensions maintaining aspect ratio
        let previewWidth = hoverPreviewSize
        let previewHeight = hoverPreviewSize
        
        if (component.viewBox) {
          const viewBoxParts = component.viewBox.split(/\s+/)
          if (viewBoxParts.length >= 4) {
            const vbWidth = parseFloat(viewBoxParts[2])
            const vbHeight = parseFloat(viewBoxParts[3])
            if (vbWidth > 0 && vbHeight > 0) {
              const aspectRatio = vbWidth / vbHeight
              if (aspectRatio > 1) {
                previewHeight = Math.round(hoverPreviewSize / aspectRatio)
              } else {
                previewWidth = Math.round(hoverPreviewSize * aspectRatio)
              }
            }
          }
        } else if (component.width && component.height) {
          const aspectRatio = component.width / component.height
          if (aspectRatio > 1) {
            previewHeight = Math.round(hoverPreviewSize / aspectRatio)
          } else {
            previewWidth = Math.round(hoverPreviewSize * aspectRatio)
          }
        }

        // Get temp file path from decoration provider (shared)
        const tempFilePath = getTempFilePath(document.uri.toString(), component.name)
        
        if (!tempFilePath) {
          markdown.appendMarkdown(`**${component.name}**\n\n`)
          markdown.appendMarkdown(`*(Preview not available - try refreshing)*\n\n`)
        } else {
          const tempFileUri = vscode.Uri.file(tempFilePath)
          markdown.appendMarkdown(`**${component.name}**\n\n`)
          markdown.appendMarkdown(`<img src="${tempFileUri.toString()}" width="${previewWidth}" height="${previewHeight}" />\n\n`)
        }

        if (component.viewBox) {
          markdown.appendMarkdown(`*viewBox:* \`${component.viewBox}\`\n\n`)
        }

        if (component.width && component.height) {
          markdown.appendMarkdown(`*size:* ${component.width} × ${component.height}`)
        }

        const range = new vscode.Range(
          new vscode.Position(component.startLine, 0),
          new vscode.Position(component.endLine, Number.MAX_VALUE)
        )

        return new vscode.Hover(markdown, range)
      },
    }
  )

  // Clear cache when document changes
  const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
    componentCache.delete(event.document.uri.toString())
  })

  // Clear cache when document closes
  const closeListener = vscode.workspace.onDidCloseTextDocument((document) => {
    componentCache.delete(document.uri.toString())
  })

  context.subscriptions.push(provider, changeListener, closeListener)

  return provider
}

/**
 * Clear all cached components
 */
export function clearComponentCache(): void {
  componentCache.clear()
}
