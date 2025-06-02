import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import path from "path";
import fs from "fs";

const COMPONENTS_PATH = path.join(import.meta.dirname, "..", "resources", "library");

export function defineComponentGenerator(server: McpServer) {
  server.tool(
    "list-liquid-components",
    "List all available Liquid components",
    {},
    async () => {
      const availableComponents = getAvailableComponents();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              action: "list_components",
              components: availableComponents,
              usage:
                "Use the 'generate-liquid-component' tool with one of these component names to generate files",
              availableNames: availableComponents.map((c) => c.name),
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "generate-liquid-component",
    "Generates a Liquid component for a Shopify theme. The Liquid component can be composed of multiple files, including Liquid, CSS, and JSON files.",
    { componentName: z.string() },
    async ({ componentName }) => {
      const availableComponents = getAvailableComponents().map((c) => c.name);

      const component = availableComponents.find((c) => c === componentName);

      if (!component) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Component '${componentName}' not found. Available components: ${availableComponents.join(", ")}`,
            },
          ],
        };
      }

      const componentFiles = getComponent(componentName);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              action: "generate_files",
              component: componentName,
              instruction:
                [
                  "Create these files in the project using file system access tools. Limit the amount of files created or modified to the ones that are necessary for the component to work.",
                  "If the file is JSON, deep-merge the contents of the file with existing files in the project on the file system.",
                  "New CSS variables added to the components should match existing naming conventions.",
                  "If the project contains other locale files (e.g. `locales/fr.json`) or locale schema files (e.g. `locales/fr.schema.json`), create the same keys as the ones from the component's `locales/en.default.json` file and `locales/en.default.schema.json` file, respectively. The values in the project's locale file should be translated to the language denoted by the file's name. E.g. if the file is `locales/fr.json`, the values should be translated to French.",
                  "Do not create JSON keys outside the ones mentioned in the component's `locales/en.default.json` file and `locales/en.default.schema.json` file.",
                ],
              files: componentFiles.map((file) => ({
                ...file,
                action: "create_file",
                path: file.filepath,
                encoding: "utf-8",
              })),
              summary: {
                totalFiles: componentFiles.length,
                fileTypes: [
                  ...new Set(
                    componentFiles.map((f) => f.filepath.split(".").pop())
                  ),
                ],
              },
            }),
          },
        ],
      };
    }
  );
}

function getAvailableComponents() {
  const items = fs.readdirSync(COMPONENTS_PATH, { withFileTypes: true });
  return items
    .filter(item => item.isDirectory())
    .map(item => {
      return {
        name: item.name,
        description: getComponentReadme(item.name),
      }
    });
}

function getComponent(name: string) {
  return readDirectoryRecursively(path.join(COMPONENTS_PATH, name));
}

function readDirectoryRecursively(resourcePath: string, relativePath: string = '') {
  const fullDirPath = path.join(resourcePath, relativePath);

  try {
    const items = fs.readdirSync(fullDirPath, { withFileTypes: true });
    const pathToContent: { filepath: string, content: string }[] = [];

    items.forEach(item => {
      if (item.isDirectory()) {
        const subDirPath = path.join(relativePath, item.name);
        pathToContent.push(
          ...readDirectoryRecursively(resourcePath, subDirPath)
        )
      } else {
        pathToContent.push({
          filepath: path.join(relativePath, item.name),
          content: fs.readFileSync(path.join(fullDirPath, item.name), 'utf-8')
        })
      }
    });
    
    return pathToContent;
  } catch (error) {
    console.error(`Error reading directory ${fullDirPath}:`, error);
    return [];
  }
}

function getComponentReadme(name: string) {
  const fullPath = path.join(COMPONENTS_PATH, name, 'README.md');
  return fs.readFileSync(fullPath, 'utf-8');
}
