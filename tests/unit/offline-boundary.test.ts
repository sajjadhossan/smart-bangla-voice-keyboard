import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const ROOTS = [
  'shared/keyboard',
  'shared/language_engine',
  'shared/transliteration',
];

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? tsFiles(path) : entry.name.endsWith('.ts') ? [path] : [];
  });
}

test('offline modules never import or call Gemini/network APIs', () => {
  const forbidden = /gemini|fetch\s*\(|XMLHttpRequest|https?:\/\//i;
  const files = ROOTS.flatMap(tsFiles);
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.equal(forbidden.test(source), false, `${file} must stay offline-only`);
  }
});
