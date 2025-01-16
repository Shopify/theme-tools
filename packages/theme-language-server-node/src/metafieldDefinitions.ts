import { runCliCommand } from './cliCommand';

export async function fetchMetafieldDefinitionsForURI(uri: string) {
  try {
    await runCliCommand('theme metafields pull', uri);
  } catch (_) {
    // CLI command can break because of incorrect version or not being logged in
    // If this fails, the user must fetch their own metafield definitions
  }
}
