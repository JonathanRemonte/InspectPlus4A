const fs = require('fs');
const os = require('os');
const path = require('path');
const { moveModule } = require('../move-module');

function setup(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'move-module-'));
  for (const [rel, body] of Object.entries(files)) {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }
  return root;
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fsMove = (a, b) => {
  fs.mkdirSync(path.dirname(b), { recursive: true });
  fs.renameSync(a, b);
};

describe('moveModule', () => {
  it('moves a directory and rewrites imports into it, out of it and within it', () => {
    const root = setup({
      'src/features/inspections/water/Form.tsx':
        "import { save } from '../hooks/save';\nimport { util } from './util';\n",
      'src/features/inspections/water/util.ts': 'export const util = 1;\n',
      'src/features/inspections/hooks/save.ts': 'export const save = 1;\n',
      'src/app/new.tsx':
        "import { Form } from '../features/inspections/water/Form';\njest.mock('../features/inspections/water/util');\n",
    });
    moveModule({ root, from: 'src/features/inspections/water', to: 'src/region/inspections/water', move: fsMove });
    expect(read(root, 'src/region/inspections/water/Form.tsx')).toBe(
      "import { save } from '../../../features/inspections/hooks/save';\nimport { util } from './util';\n",
    );
    expect(read(root, 'src/app/new.tsx')).toBe(
      "import { Form } from '../region/inspections/water/Form';\njest.mock('../region/inspections/water/util');\n",
    );
  });

  it('moves single files, extensionless and with an extension', () => {
    const root = setup({
      'src/data/boundaries.json': '[]',
      'src/data/locations.ts': 'export const L = {};\n',
      'src/constants/provinces.ts':
        "import { L } from '../data/locations';\nconst b = require('../data/boundaries.json');\n",
    });
    moveModule({ root, from: 'src/data/locations.ts', to: 'src/region/data/locations.ts', move: fsMove });
    moveModule({ root, from: 'src/data/boundaries.json', to: 'src/region/data/boundaries.json', move: fsMove });
    expect(read(root, 'src/constants/provinces.ts')).toBe(
      "import { L } from '../region/data/locations';\nconst b = require('../region/data/boundaries.json');\n",
    );
  });

  it('does not touch a sibling whose name only starts with the moved name', () => {
    const root = setup({
      'src/data/a.ts': 'export const a = 1;\n',
      'src/database/b.ts': 'export const b = 1;\n',
      'src/x.ts': "import { a } from './data/a';\nimport { b } from './database/b';\n",
    });
    const changed = moveModule({ root, from: 'src/data', to: 'src/region/data', move: fsMove });
    expect(read(root, 'src/x.ts')).toBe("import { a } from './region/data/a';\nimport { b } from './database/b';\n");
    expect(changed).toEqual([path.join(root, 'src/x.ts')]);
  });
});
