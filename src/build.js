'use strict';
const fs = require('fs');
const path = require('path');
const { renderEffect } = require('./render');

const EFFECTS_DIR = path.join(__dirname, 'effects');
const OUT_DIR = path.join(__dirname, '..', 'out');

function loadEffects(filter) {
  return fs.readdirSync(EFFECTS_DIR)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => !filter || f.includes(filter))
    .sort()
    .map((f) => require(path.join(EFFECTS_DIR, f)));
}

function main() {
  const filter = process.argv[2];
  const effects = loadEffects(filter);
  if (!effects.length) {
    console.error('No effects matched', filter || '(all)');
    process.exit(1);
  }
  console.log(`Rendering ${effects.length} effect(s) -> ${OUT_DIR}`);
  const results = [];
  for (const e of effects) {
    const start = Date.now();
    const res = renderEffect(e, OUT_DIR);
    console.log(`  ✓ ${e.name}  (${e.frames}f, ${Date.now() - start}ms)  ${path.relative(process.cwd(), res.contact)}`);
    results.push(res);
  }
  console.log('Done.');
  return results;
}

main();
