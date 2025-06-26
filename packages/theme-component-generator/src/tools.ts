import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { component } from './tools/component.ts';
import { section } from './tools/section.ts';
import { block } from './tools/block.ts';
import { snippet } from './tools/snippet.ts';

export function addTools(server: McpServer) {
  const tools = [
    // List of public tools:
    component,
    section,
    block,
    snippet,
  ];

  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, tool.callback);
  }
}
