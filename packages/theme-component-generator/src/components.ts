import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import fs from 'fs';

const COMPONENTS_PATH = path.join(import.meta.dirname, '..', 'resources', 'library');

export function defineComponentGenerator(server: McpServer) {
  const a = server.server.getClientCapabilities();

  server.tool(
    'validate-component',
    'Validate a component',
    {
      files: z
        .array(
          z.object({
            filepath: z.string(),
            content: z.string(),
          }),
        )
        .optional(),
    },
    async ({ files }) => {
      // TODO: call theme check instead of random number
      // For now, we'll validate that files were provided and have content
      if (!files || files.length === 0) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: false,
                error: 'No files provided for validation',
              }),
            },
          ],
        };
      }

      const invalidFiles = files.filter((file) => !file.content || file.content.trim() === '');

      if (invalidFiles.length > 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                valid: false,
                error: 'Some files are empty or have no content',
                invalidFiles: invalidFiles.map((f) => f.filepath),
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              valid: true,
              message: `Validated ${files.length} files successfully`,
              fileCount: files.length,
              fileTypes: [...new Set(files.map((f) => f.filepath.split('.').pop()))],
            }),
          },
        ],
      };
    },
  );

  server.tool('list-liquid-components', 'List all available Liquid components', {}, async () => {
    const availableComponents = getAvailableComponents();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            action: 'list_components',
            components: availableComponents,
            usage:
              "Use the 'generate-liquid-component' tool with one of these component names to generate files",
            availableNames: availableComponents.map((c) => c.name),
          }),
        },
      ],
    };
  });

  server.tool(
    'generate-liquid-component',
    'Generates a Liquid component for a Shopify theme. The Liquid component can be composed of multiple files, including Liquid, CSS, and JSON files.',
    { componentName: z.string() },
    async ({ componentName }) => {
      const availableComponents = getAvailableComponents().map((c) => c.name);

      const component = availableComponents.find((c) => c === componentName);

      if (!component) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Component '${componentName}' not found. Available components: ${availableComponents.join(
                ', ',
              )}`,
            },
          ],
        };
      }

      const componentFiles = getComponent(componentName);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'generate_files',
              component: componentName,
              instruction: [
                'Create these files in the project using the file system access tools. Limit the amount of files created or modified to the ones that are necessary for the component to work.',
                'Do not create README files, examples, or demo files.',
                'If the file is JSON, deep-merge the contents of the file with existing files in the project on the file system.',
                'New CSS variables added to the components should match existing naming conventions.',
                "If the project contains other locale files (e.g. `locales/fr.json`) or locale schema files (e.g. `locales/fr.schema.json`), create the same keys as the ones from the component's `locales/en.default.json` file and `locales/en.default.schema.json` file, respectively. The values in the project's locale file should be translated to the language denoted by the file's name. E.g. if the file is `locales/fr.json`, the values should be translated to French.",
                "Do not create JSON keys outside the ones mentioned in the component's `locales/en.default.json` file and `locales/en.default.schema.json` file.",
                "THE COMPONENT MUST BE VALID. USE THE 'VALIDATE-COMPONENT' TOOL TO VALIDATE THE COMPONENT AFTER GENERATING THE FILES.",
              ],
              files: componentFiles.map((file) => ({
                ...file,
                action: 'create_file',
                path: file.filepath,
                encoding: 'utf-8',
              })),
              summary: {
                totalFiles: componentFiles.length,
                fileTypes: [...new Set(componentFiles.map((f) => f.filepath.split('.').pop()))],
              },
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'create-button-component',
    'Initiates the creation of a button component by asking the user to choose between snippet or block implementation',
    {},
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'prompt_user_choice',
              component: 'button',
              message: 'Would you like to create a button as a snippet or a block?',
              choices: [
                {
                  value: 'snippet',
                  label: 'Snippet',
                  description:
                    'Creates a reusable button snippet that can be included in templates',
                },
                {
                  value: 'block',
                  label: 'Block',
                  description:
                    'Creates a button block for use in section groups with customizable settings',
                },
              ],
              nextAction:
                "Use the generate-button-snippet or generate-button-block tool based on the user's choice",
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'generate-button-snippet',
    'Generates a button component as a snippet with basic styling and parameters',
    {
      text: z.string().optional().describe('Button text'),
      url: z.string().optional().describe('Button URL'),
      style: z.enum(['primary', 'secondary', 'outline']).optional().describe('Button style'),
    },
    async ({ text = 'Click me', url = '#', style = 'primary' }) => {
      const buttonSnippetFiles = generateButtonSnippetFiles(text, url, style);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'generate_files',
              component: 'button-snippet',
              instruction: [
                'Create these files for the button snippet component.',
                'The snippet can be used by calling {% render "button", text: "Button Text", url: "/path", style: "primary" %}',
                "The CSS should be added to your theme's main stylesheet or create a dedicated button CSS file.",
                'Validate the component after creation using the validate-component tool.',
              ],
              files: buttonSnippetFiles,
              usage: {
                example: `{% render "button", text: "${text}", url: "${url}", style: "${style}" %}`,
                parameters: {
                  text: 'Button text to display',
                  url: 'URL the button should link to',
                  style: 'Button style: primary, secondary, or outline',
                },
              },
              summary: {
                totalFiles: buttonSnippetFiles.length,
                type: 'snippet',
              },
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'generate-button-block',
    'Generates a button component as a block with settings schema for customization',
    {
      sectionName: z.string().optional().describe('Name of the section to add the button block to'),
    },
    async ({ sectionName = 'custom-content' }) => {
      const buttonBlockFiles = generateButtonBlockFiles(sectionName);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action: 'generate_files',
              component: 'button-block',
              instruction: [
                'Create these files for the button block component.',
                'The block can be added to sections and customized through the theme editor.',
                'If a section file already exists, merge the block schema into the existing blocks array.',
                "The CSS should be added to your theme's main stylesheet or create a dedicated button CSS file.",
                'Validate the component after creation using the validate-component tool.',
              ],
              files: buttonBlockFiles,
              usage: {
                howToUse: 'Add this block to any section through the theme editor',
                customizable:
                  'Users can customize text, URL, style, and alignment through the editor',
              },
              summary: {
                totalFiles: buttonBlockFiles.length,
                type: 'block',
                sectionName,
              },
            }),
          },
        ],
      };
    },
  );
}

function getAvailableComponents() {
  const items = fs.readdirSync(COMPONENTS_PATH, { withFileTypes: true });
  return items
    .filter((item) => item.isDirectory())
    .map((item) => {
      return {
        name: item.name,
        description: getComponentReadme(item.name),
      };
    });
}

function getComponent(name: string) {
  return readDirectoryRecursively(path.join(COMPONENTS_PATH, name));
}

function readDirectoryRecursively(resourcePath: string, relativePath: string = '') {
  const fullDirPath = path.join(resourcePath, relativePath);

  try {
    const items = fs.readdirSync(fullDirPath, { withFileTypes: true });
    const pathToContent: { filepath: string; content: string }[] = [];

    items.forEach((item) => {
      if (item.isDirectory()) {
        const subDirPath = path.join(relativePath, item.name);
        pathToContent.push(...readDirectoryRecursively(resourcePath, subDirPath));
      } else {
        pathToContent.push({
          filepath: path.join(relativePath, item.name),
          content: fs.readFileSync(path.join(fullDirPath, item.name), 'utf-8'),
        });
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

function generateButtonSnippetFiles(text: string, url: string, style: string) {
  return [
    {
      filepath: 'snippets/button.liquid',
      content: `{%- liquid
  assign button_text = text | default: 'Click me'
  assign button_url = url | default: '#'
  assign button_style = style | default: 'primary'
  assign button_class = 'btn btn--' | append: button_style
-%}

<a href="{{ button_url }}" class="{{ button_class }}">
  {{ button_text }}
</a>`,
    },
    {
      filepath: 'assets/button.css',
      content: `.btn {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid transparent;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  line-height: 1.2;
}

.btn--primary {
  background-color: #000;
  color: #fff;
  border-color: #000;
}

.btn--primary:hover {
  background-color: #333;
  border-color: #333;
}

.btn--secondary {
  background-color: #fff;
  color: #000;
  border-color: #000;
}

.btn--secondary:hover {
  background-color: #f5f5f5;
}

.btn--outline {
  background-color: transparent;
  color: #000;
  border-color: #000;
}

.btn--outline:hover {
  background-color: #000;
  color: #fff;
}`,
    },
  ];
}

function generateButtonBlockFiles(sectionName: string) {
  return [
    {
      filepath: `sections/${sectionName}.liquid`,
      content: `{%- for block in section.blocks -%}
  {%- case block.type -%}
    {%- when 'button' -%}
      <div class="button-block" {{ block.shopify_attributes }}>
        <a href="{{ block.settings.button_url | default: '#' }}"
           class="btn btn--{{ block.settings.button_style | default: 'primary' }}"
           style="text-align: {{ block.settings.button_alignment | default: 'left' }};">
          {{ block.settings.button_text | default: 'Click me' }}
        </a>
      </div>
  {%- endcase -%}
{%- endfor -%}

{% schema %}
{
  "name": "Custom Content",
  "blocks": [
    {
      "type": "button",
      "name": "Button",
      "settings": [
        {
          "type": "text",
          "id": "button_text",
          "label": "Button Text",
          "default": "Click me"
        },
        {
          "type": "url",
          "id": "button_url",
          "label": "Button URL"
        },
        {
          "type": "select",
          "id": "button_style",
          "label": "Button Style",
          "options": [
            {
              "value": "primary",
              "label": "Primary"
            },
            {
              "value": "secondary",
              "label": "Secondary"
            },
            {
              "value": "outline",
              "label": "Outline"
            }
          ],
          "default": "primary"
        },
        {
          "type": "select",
          "id": "button_alignment",
          "label": "Button Alignment",
          "options": [
            {
              "value": "left",
              "label": "Left"
            },
            {
              "value": "center",
              "label": "Center"
            },
            {
              "value": "right",
              "label": "Right"
            }
          ],
          "default": "left"
        }
      ]
    }
  ]
}
{% endschema %}`,
    },
    {
      filepath: 'assets/button.css',
      content: `.btn {
  display: inline-block;
  padding: 12px 24px;
  border: 2px solid transparent;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 16px;
  line-height: 1.2;
}

.btn--primary {
  background-color: #000;
  color: #fff;
  border-color: #000;
}

.btn--primary:hover {
  background-color: #333;
  border-color: #333;
}

.btn--secondary {
  background-color: #fff;
  color: #000;
  border-color: #000;
}

.btn--secondary:hover {
  background-color: #f5f5f5;
}

.btn--outline {
  background-color: transparent;
  color: #000;
  border-color: #000;
}

.btn--outline:hover {
  background-color: #000;
  color: #fff;
}

.button-block {
  margin: 20px 0;
}

.button-block[style*="center"] {
  text-align: center;
}

.button-block[style*="right"] {
  text-align: right;
}`,
    },
  ];
}
