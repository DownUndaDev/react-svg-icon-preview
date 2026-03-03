/**
 * SVG Parser - Extract SVG content from React components and raw SVG files
 */

import { jsxToSvg } from './utils'

export interface ParsedSvgComponent {
  /** Component name */
  name: string
  /** Line number where the component starts (0-based) */
  startLine: number
  /** Line number where the component ends (0-based) */
  endLine: number
  /** Raw JSX content of the SVG */
  rawJsx: string
  /** Converted standard SVG string */
  svg: string
  /** ViewBox extracted from the component */
  viewBox?: string
  /** Width extracted from the component */
  width?: number
  /** Height extracted from the component */
  height?: number
  /** Whether this is a raw SVG file */
  isRawSvg?: boolean
}

/**
 * Pattern definitions for different component formats
 */
const PATTERNS = {
  // Pattern 1: export function IconName() { return <svg>...</svg> }
  functionComponent: /export\s+(?:default\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{[\s\S]*?return\s*\(\s*(<(?:svg|Svg|Icon)\b[\s\S]*?<\/(?:svg|Svg|Icon)>)\s*\)/g,

  // Pattern 2: export const IconName = () => <svg>...</svg> or with ()
  arrowFunctionDirect: /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*\([^)]*\)\s*=>\s*\(\s*(<(?:svg|Svg|Icon)\b[\s\S]*?<\/(?:svg|Svg|Icon)>)\s*\)/g,
  
  // Pattern 2b: export const IconName = () => { return <svg>...</svg> }
  arrowFunctionReturn: /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?return\s*\(\s*(<(?:svg|Svg|Icon)\b[\s\S]*?<\/(?:svg|Svg|Icon)>)\s*\)/g,

  // Pattern 3: export const IconName = forwardRef<...>((props, ref) => { return <Icon>...</Icon> })
  forwardRef: /export\s+const\s+(\w+)\s*=\s*forwardRef[^(]*\(\s*\([^)]*\)\s*=>\s*(?:\{[\s\S]*?return\s*)?\(\s*(<(?:svg|Svg|Icon)\b[\s\S]*?<\/(?:svg|Svg|Icon)>)\s*\)/g,

  // Pattern 4: const IconName = memo(() => <svg>...</svg>)
  memo: /(?:export\s+)?const\s+(\w+)\s*=\s*memo\s*\(\s*\([^)]*\)\s*=>\s*(?:\{[\s\S]*?return\s*)?\(\s*(<(?:svg|Svg|Icon)\b[\s\S]*?<\/(?:svg|Svg|Icon)>)\s*\)/g,
}

/**
 * Extract viewBox, width, and height from SVG/Icon element
 */
function extractSvgAttributes(jsx: string): { viewBox?: string; width?: number; height?: number } {
  const result: { viewBox?: string; width?: number; height?: number } = {}

  const rootTagMatch = jsx.match(/<(?:svg|Svg|Icon)\b([^>]*)>/)
  const rootAttrs = rootTagMatch?.[1] ?? ''

  const viewBoxMatch = rootAttrs.match(/\bviewBox=["']([^"']+)["']/)
  if (viewBoxMatch) {
    result.viewBox = viewBoxMatch[1]
  }

  const widthMatch = rootAttrs.match(/\bwidth\s*=\s*(?:\{?\s*["']?(-?\d*\.?\d+)\s*["']?\}?)/)
  if (widthMatch) {
    result.width = parseFloat(widthMatch[1])
  }

  const heightMatch = rootAttrs.match(/\bheight\s*=\s*(?:\{?\s*["']?(-?\d*\.?\d+)\s*["']?\}?)/)
  if (heightMatch) {
    result.height = parseFloat(heightMatch[1])
  }

  return result
}

/**
 * Find line number for a match position in the text
 */
function getLineNumber(text: string, position: number): number {
  const lines = text.substring(0, position).split('\n')
  return lines.length - 1
}

/**
 * Find end line number by counting newlines in the matched content
 */
function getEndLineNumber(text: string, startPosition: number, matchLength: number): number {
  const startLine = getLineNumber(text, startPosition)
  const matchedText = text.substring(startPosition, startPosition + matchLength)
  const newlines = (matchedText.match(/\n/g) || []).length
  return startLine + newlines
}

/**
 * Parse document text and extract all SVG components
 */
export function parseSvgComponents(
  text: string,
  options: { defaultFillColor?: string } = {}
): ParsedSvgComponent[] {
  const components: ParsedSvgComponent[] = []
  const seenNames = new Set<string>()

  // Try each pattern
  for (const [, pattern] of Object.entries(PATTERNS)) {
    // Reset regex lastIndex
    pattern.lastIndex = 0

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const [fullMatch, name, jsx] = match
      
      // Skip if we've already found this component
      if (seenNames.has(name)) {
        continue
      }

      try {
        const attrs = extractSvgAttributes(jsx)
        const svg = jsxToSvg(jsx, {
          defaultFillColor: options.defaultFillColor,
          width: attrs.width,
          height: attrs.height,
          viewBox: attrs.viewBox,
        })

        const startLine = getLineNumber(text, match.index)
        const endLine = getEndLineNumber(text, match.index, fullMatch.length)

        components.push({
          name,
          startLine,
          endLine,
          rawJsx: jsx,
          svg,
          ...attrs,
        })

        seenNames.add(name)
      } catch (error) {
        // Skip components that fail to parse
        console.error(`Failed to parse component ${name}:`, error)
      }
    }
  }

  // Sort by start line
  components.sort((a, b) => a.startLine - b.startLine)

  return components
}

/**
 * Find the SVG component at a specific line
 */
export function findComponentAtLine(
  components: ParsedSvgComponent[],
  line: number
): ParsedSvgComponent | undefined {
  return components.find((c) => line >= c.startLine && line <= c.endLine)
}

/**
 * Check if a line is the start of an SVG component declaration
 */
export function isComponentDeclarationLine(
  components: ParsedSvgComponent[],
  line: number
): ParsedSvgComponent | undefined {
  return components.find((c) => c.startLine === line)
}

/**
 * Parse a raw SVG file
 */
export function parseRawSvgFile(
  text: string,
  fileName: string
): ParsedSvgComponent[] {
  const components: ParsedSvgComponent[] = []

  // Check if this is a raw SVG file (starts with <svg or <?xml)
  const trimmedText = text.trim()
  if (!trimmedText.startsWith('<svg') && !trimmedText.startsWith('<?xml')) {
    return components
  }

  // Extract the SVG element
  const svgMatch = trimmedText.match(/<svg[\s\S]*<\/svg>/i)
  if (!svgMatch) {
    return components
  }

  const svg = svgMatch[0]
  
  // Extract attributes
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/)
  const widthMatch = svg.match(/width=["']([^"']+)["']/)
  const heightMatch = svg.match(/height=["']([^"']+)["']/)

  // Get name from filename
  const name = fileName.replace(/\.svg$/i, '').replace(/[^a-zA-Z0-9]/g, '_')

  const lines = text.split('\n')
  
  components.push({
    name,
    startLine: 0,
    endLine: lines.length - 1,
    rawJsx: svg,
    svg: svg,
    viewBox: viewBoxMatch ? viewBoxMatch[1] : undefined,
    width: widthMatch ? parseInt(widthMatch[1], 10) : undefined,
    height: heightMatch ? parseInt(heightMatch[1], 10) : undefined,
    isRawSvg: true,
  })

  return components
}

/**
 * Check if text content is a raw SVG file
 */
export function isRawSvgContent(text: string): boolean {
  const trimmed = text.trim()
  return trimmed.startsWith('<svg') || trimmed.startsWith('<?xml')
}
