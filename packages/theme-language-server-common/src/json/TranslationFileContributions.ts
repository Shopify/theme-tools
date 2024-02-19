import {
  CompletionsCollector,
  JSONPath,
  JSONWorkerContribution,
  MarkedString,
} from 'vscode-json-languageservice';
import { DocumentManager } from '../documents';
import { JSONNode, SourceCodeType } from '@shopify/theme-check-common';

function nodeAtLocation(ast: JSONNode, location: JSONPath): JSONNode | undefined {
  return location.reduce((value: JSONNode | undefined, segment: string | number) => {
    if (value && typeof value !== 'string') {
      switch (value.type) {
        case 'Object': {
          return value.children.find((child) => child.key.value === segment)?.value;
        }
        case 'Array': {
          if (typeof segment !== 'number') return undefined;
          return value.children[segment];
        }
        case 'Identifier': {
          return undefined; // trying to [segment] onto a string or number
        }
        case 'Literal': {
          return undefined; // trying to [segment] onto a string or number
        }
        case 'Property': {
          return undefined; // this shouldn't be happening
        }
      }
    }
  }, ast);
}

const nothing = undefined as any;

export class TranslationFileContributions implements JSONWorkerContribution {
  private filePatterns = [/^.*\/locales\/[^\/]*\.json$/];

  constructor(private documentManager: DocumentManager) {}

  getInfoContribution(uri: string, location: JSONPath): Promise<MarkedString[]> {
    // TODO: This is a hack to get around the fact that the JSON language service
    // actually is not typed properly and performs "if-undefined-skip" logic.
    // https://github.com/microsoft/vscode-json-languageservice/pull/222
    // would fix this, but it's not merged yet.
    if (!fileMatch(uri, this.filePatterns)) return nothing;
    const doc = this.documentManager.get(uri);
    if (!doc || location.length === 0 || doc.type !== SourceCodeType.JSON) return nothing;
    const ast = doc.ast;
    if (ast instanceof Error) return nothing;
    const node = nodeAtLocation(ast, location);

    switch (true) {
      // Because the JSON language service doesn't support composition of hover info,
      // We have to hardcode the docs for the translation file schema here.
      case ['zero', 'one', 'two', 'few', 'many', 'other'].includes(location.at(-1) as string): {
        if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
          return Promise.resolve([`Pluralized translations should have a string value`]);
        }
        return Promise.resolve([contextualizedLabel(uri, location.slice(0, -1), node.value)]);
      }

      case location.at(-1)!.toString().endsWith('_html'): {
        if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
          return Promise.resolve([`Translations ending in '_html' should have a string value`]);
        }
        return Promise.resolve([
          contextualizedLabel(uri, location, node.value),
          `The '_html' suffix prevents the HTML content from being escaped.`,
        ]);
      }

      default: {
        if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
          return Promise.resolve([`Translation group: ${location.join('.')}`]);
        }
        return Promise.resolve([contextualizedLabel(uri, location, node.value)]);
      }
    }
  }

  async collectDefaultCompletions(uri: string, result: CompletionsCollector) {}

  async collectPropertyCompletions(
    uri: string,
    location: JSONPath,
    currentWord: string,
    addValue: boolean,
    isLast: boolean,
    result: CompletionsCollector,
  ) {}

  async collectValueCompletions(
    uri: string,
    location: JSONPath,
    propertyKey: string,
    result: CompletionsCollector,
  ) {}
}

export function fileMatch(uri: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(uri));
}

export function contextualizedLabel(
  uri: string,
  str: (string | number)[],
  value: string,
): MarkedString {
  if (uri.includes('.schema')) {
    return marked(`"t:${str.join('.')}"`, 'json');
  } else {
    const params = extractParams(value);
    return marked(`{{ '${str.join('.')}' | t${paramsString(params)} }}`, 'liquid');
  }
}

function extractParams(value: string) {
  const regex = /\{\{([^}]+?)\}\}/g;
  const results = [];
  let current;
  while ((current = regex.exec(value)) !== null) {
    results.push(current[1].trim());
  }
  return results;
}

function paramsString(params: string[]) {
  if (params.length === 0) return '';
  return `: ` + params.map((param) => `${param}: ${param}`).join(', ');
}

function marked(value: string, language = 'liquid'): { language: string; value: string } {
  return { language, value };
}
