// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

// Test that verifies ManageEstablishmentsTab's filterField style override is present
// and applied to stacked SelectFields. The override clears SelectField's default flex: 1,
// preventing fields from collapsing when stacked in the filter sheet's maxHeight-only container.
//
// The ReportFilterSheet.test.tsx provides a direct executable test of the override pattern.
// This test documents that the same pattern is applied in ManageEstablishmentsTab.

describe('ManageEstablishmentsTab filter sheet field layout', () => {
  it('applies the filterField style override to stacked SelectFields', () => {
    // Verify the override is present in the component source
    const componentPath = path.join(__dirname, 'ManageEstablishmentsTab.tsx');
    const componentSource = fs.readFileSync(componentPath, 'utf-8');

    // The filterField style should have the flex: undefined override
    expect(componentSource).toMatch(/filterField:\s*\{[\s\S]*?flex:\s*undefined[\s\S]*?\}/);

    // And it should be applied to SelectFields in the filter sheet modal
    expect(componentSource).toMatch(/style=\{styles\.filterField\}/);
  });
});

// The 2026-09-05 convergence retired /establishment/edit and moved editing
// in-place into the detail screen's sections (which tapping a card already
// reaches). This tab's Edit was never rewired: it called a stub that only
// logged, so pressing it did nothing. Source-level, matching this file's
// existing convention, because rendering the tab needs the database, the
// router and three hooks mocked to assert one absent prop.
describe('ManageEstablishmentsTab wires no dead Edit action', () => {
  const source = () => fs.readFileSync(path.join(__dirname, 'ManageEstablishmentsTab.tsx'), 'utf-8');

  it('passes no onEdit to its establishment cards', () => {
    expect(source()).not.toMatch(/onEdit=/);
  });

  it('keeps no handler that only logs an unimplemented edit screen', () => {
    expect(source()).not.toMatch(/TODO: navigate to establishment edit screen/);
    expect(source()).not.toMatch(/handleEdit/);
  });
});
