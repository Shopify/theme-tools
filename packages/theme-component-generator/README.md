# Theme Component Generator

MCP (Model Context Protocol) server to generate basic Liquid components.

## 📋 Prerequisites

- Node.js 22.0.0 or higher
- yarn package manager

## 📖 Usage

### Integration with MCP Clients

To use this server with an MCP client (like Claude Desktop), add it to your MCP configuration:

```json
{
  "mcpServers": {
    "themeComponentGenerator": {
      "command": "node",
      "args": [
        "--experimental-strip-types",
        "<path-to-theme-tools>/packages/theme-component-generator/src/index.ts"
      ],
      "env": {}
    }
  }
}
```

## 🔧 Available Tools

### `generate-liquid-component`
Creates a Liquid component based on Shopify's latest Liquid standards

**Parameters:**
- `componentName` (string, required): The name of the Liquid component to generate

**Example:**
```json
{
  "name": "generate-liquid-component",
  "arguments": {
    "componentName": "accordion"
  }
}
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
