/**
 * Jest setup file
 * Configures jsdom environment for tests
 */

// Set up TextEncoder/TextDecoder BEFORE anything else
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Now import jsdom
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;
global.NodeFilter = dom.window.NodeFilter;

// Mock fetch
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

global.fetch = async (url) => {
  if (url.startsWith('/tests/')) {
    const filePath = join(__dirname, url.replace('/tests/', ''));
    const content = readFileSync(filePath, 'utf-8');
    return {
      ok: true,
      text: () => Promise.resolve(content),
      json: () => Promise.resolve(JSON.parse(content))
    };
  }
  throw new Error(`Unknown URL: ${url}`);
};

