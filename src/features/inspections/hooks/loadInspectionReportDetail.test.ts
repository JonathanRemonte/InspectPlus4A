import { loadInspectionReportDetail } from './loadInspectionReportDetail';
import { reportDataModuleFor } from '../../../core/region/lookup';

const mockFetch = jest.fn();
jest.mock('../../../db/database', () => ({
  database: {},
  collections: new Proxy({}, {
    get: (_t, name: string) => ({ query: (...args: unknown[]) => ({ fetch: () => mockFetch(name, args) }) }),
  }),
}));
jest.mock('../../../services/supabase/client', () => ({ supabase: {} }));
jest.mock('../../establishments/hooks/useEstablishment', () => ({
  isPrivilegedRole: (role: string) => role === 'Developer',
  isEstablishmentVisible: (estab: { province: string }, province: string) => estab.province === province,
  reportSyncStatusWithAttachments: () => 'synced',
}));

const report = {
  reportId: 'r1', estabId: 'e1', inspectorUid: 'u2', purposeId: 'p1', reportType: 'water_monitoring',
  reportControlNo: 'WQ-1', inspectionDate: '2026-09-01', reportStatus: 'submitted', syncState: 'synced',
  establishmentSnapshot: { name: 'Alpha' }, permitsSnapshot: [], createdAt: 'c', updatedAt: 'u',
};

function tables(map: Record<string, unknown[]>) {
  mockFetch.mockImplementation((name: string) => Promise.resolve(map[name] ?? []));
}

const viewer = { uid: 'u1', province: 'P', role: 'Inspector' };

describe('loadInspectionReportDetail', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns null when the report does not exist', async () => {
    tables({});
    expect(await loadInspectionReportDetail('r1', viewer)).toBeNull();
  });

  it("hides another inspector's report outside the viewer's province", async () => {
    tables({ inspectionReports: [report], establishments: [{ province: 'Q' }] });
    expect(await loadInspectionReportDetail('r1', viewer)).toBeNull();
  });

  const purposeOfInspection = [{ inspectionDate: '2026-09-01', verifyInfo: true, verifyInfoList: [], determineCompliance: false, investigateComplaints: false, checkCommitments: false, checkCommitmentsList: [], others: null }];

  it('loads the report, its purpose and attachments, with no compliance when the type has no module', async () => {
    tables({
      inspectionReports: [{ ...report, reportType: 'unregistered_type' }],
      establishments: [{ province: 'P' }],
      purposeOfInspection,
      attachments: [{ attachmentId: 'a1', syncState: 'synced' }],
    });
    const detail = await loadInspectionReportDetail('r1', viewer);
    expect(detail?.report.reportControlNo).toBe('WQ-1');
    expect(detail?.purpose?.verifyInfo).toBe(true);
    expect(detail?.compliance.kind).toBe('none');
    expect(detail?.attachments).toHaveLength(1);
  });

  // Needs the region to register a water_monitoring module (EMB4B does).
  const itWhenWaterRegistered = reportDataModuleFor('water_monitoring') ? it : it.skip;
  itWhenWaterRegistered("loads the region module's water compliance row", async () => {
    tables({
      inspectionReports: [report],
      establishments: [{ province: 'P' }],
      purposeOfInspection,
      complianceWater: [{ complianceId: 'c1', hasWwtp: true, samplingPoints: [], previousInspectionSummary: { hasRecords: true, dateOfSampling: '2026-01-01' } }],
      attachments: [{ attachmentId: 'a1', syncState: 'synced' }],
    });
    const detail = await loadInspectionReportDetail('r1', viewer);
    // Cast: a region with no report types has no compliance view to narrow to.
    const compliance = detail?.compliance as unknown as {
      kind: string;
      hasWwtp?: boolean;
      previousInspectionSummary?: { hasRecords: string };
    };
    expect(compliance.kind).toBe('water');
    expect(compliance.hasWwtp).toBe(true);
    expect(compliance.previousInspectionSummary?.hasRecords).toBe('yes');
  });
});
