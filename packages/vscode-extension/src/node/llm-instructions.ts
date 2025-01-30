import { ExtensionContext, Uri, window, workspace } from 'vscode';
import { getShopifyThemeRootDirs, isCursor } from './utils';
import * as path from 'node:path';
import { fileExists } from './fs';
import { themeArchitectureRules } from './shopify-magic-prompts/theme-architecture';
import { liquidRules } from './shopify-magic-prompts/liquid';
import { cssRules } from './shopify-magic-prompts/css';
import { javascriptRules } from './shopify-magic-prompts/javascript';
import { htmlRules } from './shopify-magic-prompts/html';
import { uxPrinciplesRules } from './shopify-magic-prompts/ux-principles';

/** Configuration for AI instructions file */
interface AiInstructionsConfig {
  /** File system path where instructions should be written */
  path: string;
  /** Configuration for user prompts */
  prompt: {
    /** Message shown to user prompting them to create a new instructions file */
    create: string;
    /** Message shown to user prompting them to update an existing instructions file */
    update: string;
  };
}

export async function createInstructionsFiles(ctx: ExtensionContext, log = console.error) {
  const themeRootDirs = await getShopifyThemeRootDirs();

  for (const root of themeRootDirs) {
    await createAiInstructionsFileIfNeeded(root, ctx, log);
  }
}

async function createAiInstructionsFileIfNeeded(
  root: string,
  ctx: ExtensionContext,
  log = console.error,
) {
  const config = await getAiInstructionsFileConfig(root);

  const promptType = (await fileExists(config.path)) ? 'update' : 'create';
  const promptKey = `createAiInstructionsFile:${config.path}:no-${promptType}`;
  const promptMessage = config.prompt[promptType];

  if (promptType === 'update' && (await isInstructionsFileUpdated(config, log))) {
    return; // AI instructions file is up to date
  }

  if (await hasAnswered(promptKey, ctx)) {
    return; // User has already answered "No"
  }

  const response = await window.showInformationMessage(promptMessage, 'Yes', 'No');
  if (response !== 'Yes') {
    await setAsAnswered(promptKey, ctx);
    return;
  }

  if (promptType === 'update') {
    await updateConfigFile(config);
    log(`[Shopify Magic][AI] Updated instructions file at ${config.path}`);
  } else {
    await createConfigFile(config);
    log(`[Shopify Magic][AI] Created instructions file at ${config.path}`);
  }
}

async function updateConfigFile(config: AiInstructionsConfig) {
  const uri = Uri.file(config.path);
  const content = await templateContent();

  await workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function createConfigFile(config: AiInstructionsConfig) {
  await ensureDirectory(config.path);

  const uri = Uri.file(config.path);
  const content = await templateContent();

  await workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function getAiInstructionsFileConfig(root: string): Promise<AiInstructionsConfig> {
  if (isCursor()) {
    return {
      path: path.join(root, '.cursorrules'),
      prompt: {
        create: `A Shopify theme project has been detected at "${path.basename(
          root,
        )}". Would you like to create a .cursorrules file to refine AI behavior?`,
        update:
          'A new version of the .cursorrules template is available. Would you like to update your file to access the latest features? Note: This will overwrite your existing file.',
      },
    };
  }

  return {
    path: path.join(root, '.github', 'copilot-instructions.md'),
    prompt: {
      create: `A Shopify theme project has been detected at "${path.basename(
        root,
      )}". Would you like to create a Copilot instructions file to refine AI behavior?`,
      update:
        'A new version of the Copilot instructions template is available. Would you like to update your file to access the latest features? Note: This will overwrite your existing file.',
    },
  };
}

async function ensureDirectory(pathString: string) {
  try {
    const dir = path.dirname(pathString);
    await workspace.fs.createDirectory(Uri.file(dir));
  } catch {
    // Directory might already exist
  }
}

/**
 * Checks if user has answered "No" to a prompt within the last 30 days.
 *
 * Uses globalState which persists until extension uninstall or explicit
 * clearance via context.globalState.update(key, undefined).
 */
async function hasAnswered(key: string, ctx: ExtensionContext): Promise<boolean> {
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const data = ctx.globalState.get<{ key: string; timestamp: number }>(key);

  if (!data) {
    return false;
  }

  return Date.now() - data.timestamp <= thirtyDays;
}

async function setAsAnswered(key: string, ctx: ExtensionContext): Promise<void> {
  await ctx.globalState.update(key, { key, timestamp: Date.now() });
}

/**
 * Checks if the AI instructions file needs updating by comparing content
 * similarity.
 *
 * Uses a chunk-based comparison to calculate similarity between template and
 * existing file content. This approach is more resilient to minor formatting
 * changes and custom additions while still detecting significant template
 * updates.
 *
 * The 90% similarity threshold aims to balance between preserving user
 * customizations and ensuring critical template updates are applied.
 *
 * @param config - Configuration object containing file path and prompts
 * @param log - Optional logging function, defaults to console.error
 *
 * @returns `true` if file matches template closely enough (>=90% similar)
 */
export async function isInstructionsFileUpdated(config: AiInstructionsConfig, log = console.error) {
  const normalize = (content: Uint8Array | string) => {
    const template = Buffer.from(content).toString();
    const templateMatch = template.match(/<liquid_development>([\s\S]*)<\/liquid_development>/);
    if (!templateMatch) {
      return '';
    }
    return templateMatch[1].toLowerCase().replace(/\s+/g, '');
  };

  try {
    const existingContent = await workspace.fs.readFile(Uri.file(config.path));

    const normalizedTemplate = normalize(await templateContent());
    const normalizedExisting = normalize(existingContent);

    const templateChunks: string[] = normalizedTemplate.match(/.{1,4}/g) || [];
    const existingChunks: string[] = normalizedExisting.match(/.{1,4}/g) || [];

    const commonChunks = templateChunks.filter((chunk) => existingChunks.includes(chunk));
    const similarity = commonChunks.length / Math.max(templateChunks.length, existingChunks.length);

    log(`[Shopify Magic][AI] Similarity: ${similarity}`);
    return similarity >= 0.9;
  } catch (error) {
    log(`[Shopify Magic][AI] Similarity: ${error}`);
    // If there's any error reading files, assume it's up to date
    return true;
  }
}

export async function templateContent() {
  return [
    '<liquid_development>',
    await liquidRules(),
    themeArchitectureRules(),
    uxPrinciplesRules(),
    htmlRules(),
    cssRules(),
    javascriptRules(),
    '</liquid_development>',
  ].join('\n\n');
}
