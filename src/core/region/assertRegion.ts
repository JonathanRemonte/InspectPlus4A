// Compile-time only — never imported at runtime. tsc fails here when this
// repo's region entry points stop satisfying the foundation contract.
import * as regionIndex from '../../region';
import * as regionDbIndex from '../../region/db';
import * as regionModulesIndex from '../../region/modules';
import type { RegionDbIndex, RegionIndex, RegionModulesIndex } from './contract';

export const regionIndexCheck: RegionIndex = regionIndex;
export const regionDbIndexCheck: RegionDbIndex = regionDbIndex;
export const regionModulesIndexCheck: RegionModulesIndex = regionModulesIndex;
