import { schema } from '../../db/schema';

// Pins EMB4A's assembled local schema. Regenerate only for an intended change.
describe('EMB4A local schema', () => {
  it('is version 1 with only the foundation tables', () => {
    expect(schema.version).toBe(1);
    expect(Object.keys(schema.tables).sort()).toEqual(
      ['attachments', 'establishments', 'inspection_reports', 'purpose_of_inspection', 'survey_reports'],
    );
  });

  it('keeps every table and column', () => {
    const tables = Object.keys(schema.tables)
      .sort()
      .map(name => ({ name, columns: schema.tables[name].columnArray.map(c => ({ ...c })) }));
    expect(tables).toMatchSnapshot();
  });
});
