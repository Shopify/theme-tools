import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { defineComponentGenerator } from "./components.ts";

const server = new McpServer({
  name: "theme-component-generator",
  version: "1.0.0",
});

defineComponentGenerator(server);

const transport = new StdioServerTransport();
await server.connect(transport);
