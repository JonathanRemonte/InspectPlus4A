// Compile-time only — never imported at runtime. tsc fails here when this
// repo's region entry points stop satisfying the foundation contract.
import * as regionIndex from '../../region';
import type { RegionIndex } from './contract';

export const regionIndexCheck: RegionIndex = regionIndex;
