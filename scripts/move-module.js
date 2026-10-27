#!/usr/bin/env node
// Moves a file or directory and rewrites every relative import that points
// into, out of, or within it, across src/, __tests__/ and jest.setup.js —
// so a move never leaves broken imports for tsc to report one at a time.
// Used by the region split (docs/superpowers/plans/2026-10-27-phase0-region-split.md).
//
//   node scripts/move-module.js src/features/inspections/water src/region/inspections/water
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SOURCE_FILE = /\.(ts|tsx|js|jsx)$/;
// from '…' · import '…' · import('…') · require('…') · jest.mock('…') · jest.requireActual('…')
const SPECIFIER = /((?:from|import|require|jest\.mock|jest\.requireActual)\s*\(?\s*)(['"])(\.\.?\/[^'"]+)\2/g;

const stripExt = p => p.replace(/\.(ts|tsx|js|jsx)$/, '');

function listSourceFiles(target) {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return SOURCE_FILE.test(target) ? [target] : [];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    out.push(...listSourceFiles(path.join(target, entry.name)));
  }
  return out;
}

function toSpecifier(fromDir, target) {
  const rel = path.relative(fromDir, target).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function moveModule({ root, from, to, move, scanDirs = ['src', '__tests__', 'jest.setup.js'] }) {
  const fromAbs = path.resolve(root, from);
  const toAbs = path.resolve(root, to);
  if (!fs.existsSync(fromAbs)) throw new Error(`move-module: ${from} does not exist`);
  const isFile = fs.statSync(fromAbs).isFile();
  // Import specifiers omit .ts/.tsx, so a moved source file is matched without its extension.
  const fromKey = isFile ? stripExt(fromAbs) : fromAbs;
  const toKey = isFile ? stripExt(toAbs) : toAbs;

  const relocate = p => {
    if (p === fromKey || p === fromAbs) return p === fromAbs ? toAbs : toKey;
    if (p.startsWith(fromKey + path.sep)) return toKey + p.slice(fromKey.length);
    return null;
  };

  const files = scanDirs.flatMap(d => listSourceFiles(path.resolve(root, d)));
  move(fromAbs, toAbs);

  const changed = [];
  for (const oldPath of files) {
    const newPath = relocate(oldPath) ?? oldPath;
    const oldDir = path.dirname(oldPath);
    const newDir = path.dirname(newPath);
    const before = fs.readFileSync(newPath, 'utf8');
    const after = before.replace(SPECIFIER, (match, prefix, quote, spec) => {
      const target = path.resolve(oldDir, spec);
      const next = toSpecifier(newDir, relocate(target) ?? target);
      return next === spec ? match : `${prefix}${quote}${next}${quote}`;
    });
    if (after !== before) {
      fs.writeFileSync(newPath, after);
      changed.push(newPath);
    }
  }
  return changed;
}

if (require.main === module) {
  const [from, to] = process.argv.slice(2);
  if (!from || !to) {
    console.error('usage: node scripts/move-module.js <from> <to>');
    process.exit(1);
  }
  const root = path.resolve(__dirname, '..');
  const changed = moveModule({
    root,
    from,
    to,
    move: (a, b) => {
      fs.mkdirSync(path.dirname(b), { recursive: true });
      execFileSync('git', ['mv', a, b], { cwd: root, stdio: 'inherit' });
    },
  });
  console.log(`moved ${from} -> ${to}; rewrote imports in ${changed.length} file(s)`);
}

module.exports = { moveModule };
