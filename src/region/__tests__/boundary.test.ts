import * as path from 'path';

// ESLint's dependency @ungap/structured-clone reads global.structuredClone, which
// jest-expo replaces with a lazy getter that throws here. Pin a plain value first.
Object.defineProperty(globalThis, 'structuredClone', {
  value: (v: unknown) => JSON.parse(JSON.stringify(v)),
  configurable: true,
  writable: true,
});
// eslint ships no types and @types/eslint is not a dependency, so type the slice used here.
interface LintResult {
  messages: { ruleId: string | null; message: string }[];
}
type ESLintClass = new (options: { cwd: string }) => {
  lintText(code: string, options: { filePath: string }): Promise<LintResult[]>;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ESLint } = require('eslint') as { ESLint: ESLintClass };

// The foundation/region boundary (docs/upstream-merge.md): outside
// src/region/, region code is reachable only through its three entry points.
const eslint = new ESLint({ cwd: path.resolve(__dirname, '../../..') });

async function errorsFor(filePath: string, specifier: string): Promise<string[]> {
  const [result] = await eslint.lintText(`import x from '${specifier}';\nexport default x;\n`, { filePath });
  return result.messages.filter(m => m.ruleId === 'no-restricted-imports').map(m => m.message);
}

describe('region boundary', () => {
  // The first lint loads ESLint and the TS parser, which can exceed Jest's 5s default.
  beforeAll(() => errorsFor('src/features/example.ts', '../region'), 60000);

  it.each(['../region', '../region/db', '../region/modules'])('lets foundation import the entry point %s', async spec => {
    expect(await errorsFor('src/features/example.ts', spec)).toEqual([]);
  });

  it.each(['../region/catalog', '../region/inspections/water/Form', '../region/db/models/ComplianceWater'])(
    'blocks foundation from importing region internals (%s)',
    async spec => {
      expect(await errorsFor('src/features/example.ts', spec)).toHaveLength(1);
    },
  );

  it('lets foundation import the foundation-owned region contract', async () => {
    expect(await errorsFor('src/features/example.ts', '../core/region/contract')).toEqual([]);
  });

  it('lets region code import its own internals', async () => {
    expect(await errorsFor('src/region/modules/example.ts', '../inspections/water/Form')).toEqual([]);
  });
});
