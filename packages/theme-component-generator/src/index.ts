import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { addTools } from './tools.ts';

const server = new McpServer({
  name: 'theme-component-generator',
  version: '1.0.0',
});

addTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
