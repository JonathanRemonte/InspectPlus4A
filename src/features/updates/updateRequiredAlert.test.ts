import { Linking } from 'react-native';
import { showUpdateRequiredAlert } from './updateRequiredAlert';
import { LATEST_APK_URL } from './checkForUpdate';
import { registerPromptHandler, type PromptRequest } from '../../services/prompt/promptService';

describe('showUpdateRequiredAlert', () => {
  afterEach(() => registerPromptHandler(null));

  it('names the minimum version and offers the stable APK download beside dismiss', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const seen: PromptRequest[] = [];
    registerPromptHandler((request, resolve) => {
      seen.push(request);
      resolve('download');
    });

    await showUpdateRequiredAlert('1.2.0', 'Nothing was changed.');

    expect(seen).toHaveLength(1);
    expect(seen[0].title).toBe('Update required');
    expect(seen[0].message).toContain('at least version 1.2.0');
    expect(seen[0].message).toContain('Nothing was changed.');
    expect(seen[0].actions?.map(a => a.label)).toEqual(['Later', 'Download']);
    expect(open).toHaveBeenCalledWith(LATEST_APK_URL);
    open.mockRestore();
  });

  it('opens nothing when the inspector dismisses it', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    registerPromptHandler((_request, resolve) => resolve('later'));

    await showUpdateRequiredAlert('1.2.0');

    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
