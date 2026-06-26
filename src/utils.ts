/**
 * Utility functions for SVG conversion and processing
 */

/**
 * Convert camelCase JSX attribute names to kebab-case SVG attribute names
 */
export function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Map of JSX attribute names to SVG attribute names
 */
const jsxToSvgAttrMap: Record<string, string> = {
  className: "class",
  fillRule: "fill-rule",
  clipRule: "clip-rule",
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeMiterlimit: "stroke-miterlimit",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeOpacity: "stroke-opacity",
  fillOpacity: "fill-opacity",
  xlinkHref: "xlink:href",
  xmlSpace: "xml:space",
  xmlLang: "xml:lang",
  xmlnsXlink: "xmlns:xlink",
  clipPath: "clip-path",
  fontFamily: "font-family",
  fontSize: "font-size",
  fontWeight: "font-weight",
  textAnchor: "text-anchor",
  dominantBaseline: "dominant-baseline",
  alignmentBaseline: "alignment-baseline",
  baselineShift: "baseline-shift",
  stopColor: "stop-color",
  stopOpacity: "stop-opacity",
  colorInterpolation: "color-interpolation",
  colorInterpolationFilters: "color-interpolation-filters",
  floodColor: "flood-color",
  floodOpacity: "flood-opacity",
  lightingColor: "lighting-color",
  markerStart: "marker-start",
  markerMid: "marker-mid",
  markerEnd: "marker-end",
  paintOrder: "paint-order",
  shapeRendering: "shape-rendering",
  textRendering: "text-rendering",
  imageRendering: "image-rendering",
  vectorEffect: "vector-effect",
};

/**
 * Convert JSX attribute name to SVG attribute name
 */
export function convertJsxAttr(attr: string): string {
  if (jsxToSvgAttrMap[attr]) {
    return jsxToSvgAttrMap[attr];
  }
  // For other attributes, convert camelCase to kebab-case if needed
  if (/[A-Z]/.test(attr)) {
    return camelToKebab(attr);
  }
  return attr;
}

/**
 * Convert JSX/React SVG component to standard SVG string
 */
export function jsxToSvg(
  jsxString: string,
  options: {
    defaultFillColor?: string;
    width?: number;
    height?: number;
    viewBox?: string;
  } = {}
): string {
  const { defaultFillColor = "#888888", width = 16, height = 16 } = options;

  const hasIconLikeTag = /<(?:Icon|Svg)\b/i.test(jsxString);
  let svg = jsxString;

  /**
   * React Native SVG support:
   * Convert react-native-svg components into normal SVG tags
   */
  svg = svg.replace(/<Icon\b/gi, "<svg");
  svg = svg.replace(/<\/Icon>/gi, "</svg>");
  svg = svg.replace(/<Svg\b/gi, "<svg");
  svg = svg.replace(/<\/Svg>/gi, "</svg>");

  const RN_TAGS: Record<string, string> = {
    Path: "path",
    Circle: "circle",
    Rect: "rect",
    Line: "line",
    Polygon: "polygon",
    Polyline: "polyline",
    Ellipse: "ellipse",
    G: "g",
  };

  for (const [rnTag, svgTag] of Object.entries(RN_TAGS)) {
    svg = svg.replace(new RegExp(`<${rnTag}\\b`, "g"), `<${svgTag}`);

    svg = svg.replace(new RegExp(`</${rnTag}>`, "g"), `</${svgTag}>`);
  }

  /**
   * Remove React / React Native only props
   */
  svg = svg.replace(/\s+ref=\{[^}]*\}/g, "");

  svg = svg.replace(/\s+\{\.\.\.props\}/g, "");
  svg = svg.replace(/\s+\{\.\.\.rest\}/g, "");

  svg = svg.replace(
    /\s+(testID|accessible|accessibilityLabel|accessibilityRole|pointerEvents|onPress)=\{[^}]*\}/g,
    ""
  );

  svg = svg.replace(/\s+style=\{[^}]*\}/g, "");

  /**
   * React className is meaningless in SVG preview
   */
  svg = svg.replace(/\s+className=\{[^}]+\}/g, "");

  /**
   * Keep static colors
   */
  svg = svg.replace(/\s+color=["'][^"']*["']/g, "");

  /**
   * Convert JSX expressions
   */

  // width={24}
  svg = svg.replace(/(\w+)=\{(\d+(?:\.\d+)?)\}/g, '$1="$2"');

  // fill={"red"}
  svg = svg.replace(/(\w+)=\{["']([^"']+)["']\}/g, '$1="$2"');

  /**
   * Dynamic React Native props
   *
   * fill={color}
   * stroke={className}
   */
  // Dynamic colour props
  svg = svg.replace(
    /\s+(fill|stroke|color)=\{(?:props\.)?(\w+)\}/g,
    ` $1="${defaultFillColor}"`
  );

  // Preserve explicit transparent fills
  svg = svg.replace(/\s+(fill|stroke)="none"/g, ' $1="none"');

  /**
   * Handle:
   * fill={props.fill || "#fff"}
   */
  svg = svg.replace(
    /(\w+)=\{props\.\w+\s*\|\|\s*["']([^"']+)["']\}/g,
    '$1="$2"'
  );

  /**
   * Convert JSX attributes:
   * strokeWidth -> stroke-width
   */
  svg = svg.replace(/\s(\w+)=/g, (match, attr) => {
    return ` ${convertJsxAttr(attr)}=`;
  });

  /**
   * Fix attributes that should stay camelCase
   */
  svg = svg.replace(/view-box=/g, "viewBox=");

  /**
   * Remove anything still unresolved
   */
  svg = svg.replace(
    /\s+(fill|stroke|color)=\{[^}]*\}/g,
    ` $1="${defaultFillColor}"`
  );

  svg = svg.replace(/\s+\w+=\{[^}]*\}/g, "");

  /**
   * Ensure SVG namespace
   */
  if (!svg.includes("xmlns=")) {
    svg = svg.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  /**
   * ViewBox handling
   */
  let viewBox = options.viewBox || `0 0 ${width} ${height}`;

  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);

  if (viewBoxMatch) {
    viewBox = viewBoxMatch[1];
  }

  if (!svg.includes("viewBox=")) {
    if (hasIconLikeTag) {
      viewBox = "0 0 24 24";
    }

    svg = svg.replace(/<svg/, `<svg viewBox="${viewBox}"`);
  }

  /**
   * Width / height defaults
   */
  if (!svg.includes("width=")) {
    svg = svg.replace(/<svg/, `<svg width="${width}"`);
  }

  if (!svg.includes("height=")) {
    svg = svg.replace(/<svg/, `<svg height="${height}"`);
  }

  return svg.trim();
}

/**
 * Parse the first numeric value from an attribute in a tag.
 */
function readTagNumber(tag: string, attr: string): number | undefined {
  const match = tag.match(new RegExp(`${attr}=["']\\s*(-?\\d*\\.?\\d+)`, "i"));
  if (!match) {
    return undefined;
  }
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Detect a reasonable max coordinate from common SVG primitives.
 */
function detectMaxCoordinate(svg: string): number {
  let maxCoord = 0;

  const setMax = (value?: number) => {
    if (value === undefined) {
      return;
    }
    const abs = Math.abs(value);
    if (abs > maxCoord && abs < 1000) {
      maxCoord = abs;
    }
  };

  const rectMatches = svg.match(/<rect\b[^>]*>/gi) || [];
  for (const tag of rectMatches) {
    const x = readTagNumber(tag, "x") ?? 0;
    const y = readTagNumber(tag, "y") ?? 0;
    const width = readTagNumber(tag, "width") ?? 0;
    const height = readTagNumber(tag, "height") ?? 0;
    setMax(x + width);
    setMax(y + height);
  }

  const circleMatches = svg.match(/<circle\b[^>]*>/gi) || [];
  for (const tag of circleMatches) {
    const cx = readTagNumber(tag, "cx") ?? 0;
    const cy = readTagNumber(tag, "cy") ?? 0;
    const r = readTagNumber(tag, "r") ?? 0;
    setMax(cx + r);
    setMax(cy + r);
  }

  const ellipseMatches = svg.match(/<ellipse\b[^>]*>/gi) || [];
  for (const tag of ellipseMatches) {
    const cx = readTagNumber(tag, "cx") ?? 0;
    const cy = readTagNumber(tag, "cy") ?? 0;
    const rx = readTagNumber(tag, "rx") ?? 0;
    const ry = readTagNumber(tag, "ry") ?? 0;
    setMax(cx + rx);
    setMax(cy + ry);
  }

  const lineMatches = svg.match(/<line\b[^>]*>/gi) || [];
  for (const tag of lineMatches) {
    setMax(readTagNumber(tag, "x1"));
    setMax(readTagNumber(tag, "y1"));
    setMax(readTagNumber(tag, "x2"));
    setMax(readTagNumber(tag, "y2"));
  }

  const pointsMatches = svg.matchAll(/points=["']([^"']+)["']/gi);
  for (const match of pointsMatches) {
    const numbers = match[1].match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!numbers) {
      continue;
    }
    for (const raw of numbers) {
      setMax(parseFloat(raw));
    }
  }

  const pathMatches = svg.matchAll(/d="([^"]+)"/g);
  for (const match of pathMatches) {
    const numbers = match[1].match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!numbers) {
      continue;
    }
    for (const raw of numbers) {
      setMax(parseFloat(raw));
    }
  }

  return maxCoord;
}

/**
 * Convert SVG string to data URI
 */
export function svgToDataUri(svg: string): string {
  // Encode the SVG for use in a data URI
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");

  return `data:image/svg+xml,${encoded}`;
}

/**
 * Convert SVG string to base64 data URI
 */
export function svgToBase64DataUri(svg: string): string {
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Create a simple SVG placeholder for when parsing fails
 */
export function createPlaceholderSvg(size: number = 16): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#f0f0f0" rx="2"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="8" fill="#999">?</text>
  </svg>`;
}
