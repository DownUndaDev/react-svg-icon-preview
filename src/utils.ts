/**
 * Utility functions for SVG conversion and processing
 */

/**
 * Convert camelCase JSX attribute names to kebab-case SVG attribute names
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Map of JSX attribute names to SVG attribute names
 */
const jsxToSvgAttrMap: Record<string, string> = {
  className: 'class',
  fillRule: 'fill-rule',
  clipRule: 'clip-rule',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeOpacity: 'stroke-opacity',
  fillOpacity: 'fill-opacity',
  xlinkHref: 'xlink:href',
  xmlSpace: 'xml:space',
  xmlLang: 'xml:lang',
  xmlnsXlink: 'xmlns:xlink',
  clipPath: 'clip-path',
  fontFamily: 'font-family',
  fontSize: 'font-size',
  fontWeight: 'font-weight',
  textAnchor: 'text-anchor',
  dominantBaseline: 'dominant-baseline',
  alignmentBaseline: 'alignment-baseline',
  baselineShift: 'baseline-shift',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
  colorInterpolation: 'color-interpolation',
  colorInterpolationFilters: 'color-interpolation-filters',
  floodColor: 'flood-color',
  floodOpacity: 'flood-opacity',
  lightingColor: 'lighting-color',
  markerStart: 'marker-start',
  markerMid: 'marker-mid',
  markerEnd: 'marker-end',
  paintOrder: 'paint-order',
  shapeRendering: 'shape-rendering',
  textRendering: 'text-rendering',
  imageRendering: 'image-rendering',
  vectorEffect: 'vector-effect',
}

/**
 * Convert JSX attribute name to SVG attribute name
 */
export function convertJsxAttr(attr: string): string {
  if (jsxToSvgAttrMap[attr]) {
    return jsxToSvgAttrMap[attr]
  }
  // For other attributes, convert camelCase to kebab-case if needed
  if (/[A-Z]/.test(attr)) {
    return camelToKebab(attr)
  }
  return attr
}

/**
 * Convert JSX/React SVG component to standard SVG string
 */
export function jsxToSvg(
  jsxString: string,
  options: {
    defaultFillColor?: string
    width?: number
    height?: number
    viewBox?: string
  } = {}
): string {
  const { defaultFillColor = '#888888', width = 16, height = 16 } = options

  const hasIconLikeTag = /<(?:Icon|Svg)\b/i.test(jsxString)
  let svg = jsxString

  // Check if Icon/Svg wraps an inner <svg> element - if so, extract the inner svg
  const innerSvgMatch = svg.match(/<(?:Icon|Svg)\b[^>]*>\s*(<svg[\s\S]*<\/svg>)\s*<\/(?:Icon|Svg)>/i)
  if (innerSvgMatch) {
    // Extract viewBox from outer Icon if inner svg doesn't have it
    const outerViewBoxMatch = svg.match(/<(?:Icon|Svg)\b[^>]*viewBox=["']([^"']+)["']/)
    svg = innerSvgMatch[1]
    
    // If inner svg doesn't have viewBox, add it from outer
    if (outerViewBoxMatch && !svg.includes('viewBox=')) {
      svg = svg.replace(/<svg/, `<svg viewBox="${outerViewBoxMatch[1]}"`)
    }
  } else {
    // Replace Icon/Svg component tags with standard svg tag
    svg = svg.replace(/<Icon\b/gi, '<svg')
    svg = svg.replace(/<\/Icon>/gi, '</svg>')
    svg = svg.replace(/<Svg\b/gi, '<svg')
    svg = svg.replace(/<\/Svg>/gi, '</svg>')
  }

  // Remove ref attribute
  svg = svg.replace(/\s+ref=\{[^}]*\}/g, '')

  // Remove spread props like {...props}
  svg = svg.replace(/\s+\{\.\.\.props\}/g, '')
  svg = svg.replace(/\s+\{\.\.\.rest\}/g, '')

  // Remove color attribute (not valid in SVG, fill is used on child elements)
  svg = svg.replace(/\s+color=["'][^"']*["']/g, '')
  svg = svg.replace(/\s+color=\{[^}]*\}/g, '')

  // Remove fill="none" from the root svg element (it makes the whole SVG invisible)
  // but keep it on child elements
  svg = svg.replace(/(<svg[^>]*)\s+fill=["']none["']/, '$1')

  // Convert numeric JSX expressions to string attributes: attr={16} -> attr="16"
  svg = svg.replace(/(\w+)=\{(\d+(?:\.\d+)?)\}/g, '$1="$2"')

  // Convert string JSX expressions: attr={"value"} or attr={'value'} -> attr="value"
  svg = svg.replace(/(\w+)=\{["']([^"']+)["']\}/g, '$1="$2"')

  // Convert JSX style objects to inline style strings
  // e.g., style={{ maskType: 'alpha' }} -> style="mask-type: alpha"
  svg = svg.replace(/style=\{\{([^}]+)\}\}/g, (match, styleContent) => {
    // Parse the style object content
    const styles = styleContent
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
      .map((s: string) => {
        // Handle: maskType: 'alpha' or maskType: "alpha"
        const colonIndex = s.indexOf(':')
        if (colonIndex === -1) return ''
        const key = s.substring(0, colonIndex).trim()
        let value = s.substring(colonIndex + 1).trim()
        // Remove quotes from value
        value = value.replace(/^['"]|['"]$/g, '')
        // Convert camelCase to kebab-case
        const kebabKey = key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
        return `${kebabKey}: ${value}`
      })
      .filter((s: string) => s.length > 0)
      .join('; ')
    return `style="${styles}"`
  })

  // Handle dynamic attributes like fill={props.fill || "#color"}
  // Replace with the fallback value or default color
  svg = svg.replace(
    /(\w+)=\{(?:props\.\w+\s*\?\s*props\.\w+\s*:\s*)?['"]([^'"]+)['"]\}/g,
    '$1="$2"'
  )
  svg = svg.replace(
    /(\w+)=\{props\.\w+\s*\|\|\s*['"]([^'"]+)['"]\}/g,
    '$1="$2"'
  )

  // Replace currentColor with default color
  svg = svg.replace(/currentColor/g, defaultFillColor)

  // Convert JSX attribute names to SVG attribute names
  // Match attribute="value" patterns
  svg = svg.replace(/\s(\w+)=/g, (match, attr) => {
    const svgAttr = convertJsxAttr(attr)
    return ` ${svgAttr}=`
  })

  // Remove remaining JSX expressions that couldn't be resolved
  svg = svg.replace(/\s+\w+=\{[^}]*\}/g, '')

  // Extract viewBox if present, otherwise use default
  const viewBoxMatch = svg.match(/view-box=["']([^"']+)["']/)
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : options.viewBox || `0 0 ${width} ${height}`

  // Fix viewBox attribute (it was converted to view-box by camelToKebab, need to keep it as viewBox)
  svg = svg.replace(/view-box=/g, 'viewBox=')

  // Ensure svg has proper attributes
  if (!svg.includes('xmlns=')) {
    svg = svg.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
  }

  // Try to detect viewBox from path coordinates if not set
  let finalViewBox = viewBox
  if (!svg.includes('viewBox=')) {
    if (hasIconLikeTag) {
      // Most React icon components are designed for a 24x24 coordinate system.
      finalViewBox = options.viewBox || '0 0 24 24'
    } else {
      // Detect range from common geometry attributes and path data.
      // This prevents clipping when SVG uses rect/circle/etc without viewBox.
      let maxCoord = detectMaxCoordinate(svg)

      // Determine viewBox based on max coordinate found
      if (maxCoord > 0) {
        // Round up to common viewBox sizes
        let size = 16
        if (maxCoord > 16) size = 24
        if (maxCoord > 24) size = 32
        if (maxCoord > 32) size = 48
        if (maxCoord > 48) size = 64
        if (maxCoord > 64) size = Math.ceil(maxCoord / 10) * 10
        finalViewBox = `0 0 ${size} ${size}`
      }
    }

    svg = svg.replace(/<svg/, `<svg viewBox="${finalViewBox}"`)
  }

  // Ensure width and height are set
  if (!svg.includes('width=')) {
    svg = svg.replace(/<svg/, `<svg width="${width}"`)
  }
  if (!svg.includes('height=')) {
    svg = svg.replace(/<svg/, `<svg height="${height}"`)
  }

  return svg.trim()
}

/**
 * Parse the first numeric value from an attribute in a tag.
 */
function readTagNumber(tag: string, attr: string): number | undefined {
  const match = tag.match(new RegExp(`${attr}=["']\\s*(-?\\d*\\.?\\d+)`, 'i'))
  if (!match) {
    return undefined
  }
  const value = parseFloat(match[1])
  return Number.isFinite(value) ? value : undefined
}

/**
 * Detect a reasonable max coordinate from common SVG primitives.
 */
function detectMaxCoordinate(svg: string): number {
  let maxCoord = 0

  const setMax = (value?: number) => {
    if (value === undefined) {
      return
    }
    const abs = Math.abs(value)
    if (abs > maxCoord && abs < 1000) {
      maxCoord = abs
    }
  }

  const rectMatches = svg.match(/<rect\b[^>]*>/gi) || []
  for (const tag of rectMatches) {
    const x = readTagNumber(tag, 'x') ?? 0
    const y = readTagNumber(tag, 'y') ?? 0
    const width = readTagNumber(tag, 'width') ?? 0
    const height = readTagNumber(tag, 'height') ?? 0
    setMax(x + width)
    setMax(y + height)
  }

  const circleMatches = svg.match(/<circle\b[^>]*>/gi) || []
  for (const tag of circleMatches) {
    const cx = readTagNumber(tag, 'cx') ?? 0
    const cy = readTagNumber(tag, 'cy') ?? 0
    const r = readTagNumber(tag, 'r') ?? 0
    setMax(cx + r)
    setMax(cy + r)
  }

  const ellipseMatches = svg.match(/<ellipse\b[^>]*>/gi) || []
  for (const tag of ellipseMatches) {
    const cx = readTagNumber(tag, 'cx') ?? 0
    const cy = readTagNumber(tag, 'cy') ?? 0
    const rx = readTagNumber(tag, 'rx') ?? 0
    const ry = readTagNumber(tag, 'ry') ?? 0
    setMax(cx + rx)
    setMax(cy + ry)
  }

  const lineMatches = svg.match(/<line\b[^>]*>/gi) || []
  for (const tag of lineMatches) {
    setMax(readTagNumber(tag, 'x1'))
    setMax(readTagNumber(tag, 'y1'))
    setMax(readTagNumber(tag, 'x2'))
    setMax(readTagNumber(tag, 'y2'))
  }

  const pointsMatches = svg.matchAll(/points=["']([^"']+)["']/gi)
  for (const match of pointsMatches) {
    const numbers = match[1].match(/[-+]?[0-9]*\.?[0-9]+/g)
    if (!numbers) {
      continue
    }
    for (const raw of numbers) {
      setMax(parseFloat(raw))
    }
  }

  const pathMatches = svg.matchAll(/d="([^"]+)"/g)
  for (const match of pathMatches) {
    const numbers = match[1].match(/[-+]?[0-9]*\.?[0-9]+/g)
    if (!numbers) {
      continue
    }
    for (const raw of numbers) {
      setMax(parseFloat(raw))
    }
  }

  return maxCoord
}

/**
 * Convert SVG string to data URI
 */
export function svgToDataUri(svg: string): string {
  // Encode the SVG for use in a data URI
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')

  return `data:image/svg+xml,${encoded}`
}

/**
 * Convert SVG string to base64 data URI
 */
export function svgToBase64DataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

/**
 * Create a simple SVG placeholder for when parsing fails
 */
export function createPlaceholderSvg(size: number = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#f0f0f0" rx="2"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="8" fill="#999">?</text>
  </svg>`
}
