import { schema } from '../schema';

// Pins the assembled local schema across the region split: same version,
// same tables, same columns. Regenerate only for an intended schema change.
describe('local schema', () => {
  it('is version 16', () => {
    expect(schema.version).toBe(16);
  });

  it('keeps every table and column', () => {
    const tables = Object.keys(schema.tables)
      .sort()
      .map(name => ({ name, columns: schema.tables[name].columnArray.map(c => ({ ...c })) }));
    expect(tables).toMatchSnapshot();
  });
});
