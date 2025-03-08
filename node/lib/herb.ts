import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface HerbModule {
  parse(source: string): { source: string };
  lex(source: string): { source: string };
  parseFile(path: string): { source: string };
  lexFile(path: string): { source: string };
  lexToJson(source: string): string;
  extractRuby(source: string): string;
  extractHtml(source: string): string;
  version(): string;
}

const require = createRequire(import.meta.url);
export const herbNative = require(join(__dirname, '../../build/Release/herb.node'));
