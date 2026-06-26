# React SVG Preview

[中文文档](./README.zh-CN.md)

A VS Code/Cursor extension that provides inline preview and hover preview for React SVG icon components.

## Features

- **Inline Icon Preview**: Shows SVG icon thumbnails in the editor gutter next to component declarations
- **Hover Preview**: Displays a larger preview when hovering over SVG components
- **Multi-format Support**: Works with various React component patterns:
  - Standard function components
  - Arrow function components
  - forwardRef wrapped components
  - memo wrapped components

## Supported Patterns

```tsx
// Pattern 1: Standard function component
export function IconName() {
  return <svg>...</svg>;
}

// Pattern 2: Arrow function
export const IconName = () => <svg>...</svg>;

// Pattern 3: forwardRef (common in design systems)
export const IconName = forwardRef<"svg", IconProps>((props, ref) => {
  return <Icon viewBox="0 0 16 16">...</Icon>;
});

// Pattern 4: memo
export const IconName = memo(() => <svg>...</svg>);
```

## Configuration

| Setting                            | Type    | Default   | Description                      |
| ---------------------------------- | ------- | --------- | -------------------------------- |
| `reactSvgPreview.enabled`          | boolean | `true`    | Enable/disable the extension     |
| `reactSvgPreview.iconSize`         | number  | `16`      | Size of inline icon preview (px) |
| `reactSvgPreview.showInlineIcon`   | boolean | `true`    | Show inline icon in gutter       |
| `reactSvgPreview.showHoverPreview` | boolean | `true`    | Show hover preview               |
| `reactSvgPreview.hoverPreviewSize` | number  | `64`      | Size of hover preview (px)       |
| `reactSvgPreview.defaultFillColor` | string  | `#888888` | Default fill for currentColor    |

## Commands

- **Toggle React SVG Preview**: Enable/disable the preview
- **Refresh React SVG Preview**: Refresh and rescan the current file

## Installation

### From VSIX

1. Download the `.vsix` file from releases or install from source locally (below)
2. In VS Code/Cursor: Extensions → "..." → "Install from VSIX..."

### From Source

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Package
npm run package

# Install the generated .vsix file
code --install-extension react-native-svg-icon-preview-0.2.2.vsix
```

## Development

```bash
# Watch mode for development
npm run watch

# Press F5 in VS Code to launch extension development host
```

## License

MIT
