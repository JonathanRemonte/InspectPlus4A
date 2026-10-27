// The receiving bodies of water an outlet can discharge into, filtered to
// the establishment's province. Backed by the bundled dataset in
// src/data/mimaropaWaterbodies.ts, mirroring how provinces.ts is backed by
// mimaropaLocations.ts.
import { WATERBODIES, WaterbodyGroup } from './mimaropaWaterbodies';

export type { WaterbodyGroup };

// Appended to every province's list. The 2020 list is not exhaustive - an
// outlet can discharge into an unclassified creek or a drainage canal - and
// reports predating the dropdown hold free text here. Selecting this
// reveals a text box; see decodeReceivingBodyOfWater in waterTypes.ts.
export const WATERBODY_NOT_LISTED = 'Not listed (specify)';

const ALL_GROUPS: WaterbodyGroup[] = Object.values(WATERBODIES).reduce<WaterbodyGroup[]>(
  (merged, groups) => {
    groups.forEach(group => {
      const existing = merged.find(g => g.label === group.label);
      if (existing) existing.options = [...existing.options, ...group.options].sort();
      else merged.push({ label: group.label, options: [...group.options] });
    });
    return merged;
  },
  [],
);

// An establishment outside EMB Region 4-B, or one whose province was never
// filled in, gets every province's waterbodies rather than an empty picker.
// A dropdown with nothing in it is a dead end; a long one is merely long,
// and SelectField has a search box.
export function getWaterbodyGroups(province: string): WaterbodyGroup[] {
  return WATERBODIES[province] ?? ALL_GROUPS;
}
