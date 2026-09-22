const fs = require('fs');
const path = require('path');

// app.json's version is what the running JS reports about itself
// (Constants.expoConfig.version -> utils/version.ts), and it drives the
// sync min-version gate and the update banner. The committed native
// projects carry their own copy, and because android/ and ios/ are checked
// in, an app.json bump never reaches a build on its own.
//
// They drifted once already: the 1.0.4 bump (f1a631f) edited app.json
// alone, so the footer read 1.0.4 while Android's app info read 1.0.3 off
// build.gradle. This guard fails the moment they diverge again.
const ROOT = path.resolve(__dirname, '..', '..');

const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function appJsonVersion() {
  return JSON.parse(read('app.json')).expo.version;
}

function gradleVersionName() {
  const match = read('android/app/build.gradle').match(/versionName\s+"([^"]+)"/);
  if (!match) throw new Error('No versionName found in android/app/build.gradle');
  return match[1];
}

function iosMarketingVersions() {
  const pbxproj = read('ios/InspectPlus.xcodeproj/project.pbxproj');
  const matches = [...pbxproj.matchAll(/MARKETING_VERSION = ([^;]+);/g)].map(m => m[1].trim());
  if (matches.length === 0) throw new Error('No MARKETING_VERSION found in the Xcode project');
  return matches;
}

describe('app version stays in sync across app.json and the native projects', () => {
  it("android/app/build.gradle's versionName matches app.json", () => {
    expect(gradleVersionName()).toBe(appJsonVersion());
  });

  it("every iOS MARKETING_VERSION matches app.json", () => {
    // One per build configuration (Debug/Release); all must agree.
    for (const marketingVersion of iosMarketingVersions()) {
      expect(marketingVersion).toBe(appJsonVersion());
    }
  });

  it('android versionCode is an integer, which is what Android compares on upgrade', () => {
    const match = read('android/app/build.gradle').match(/versionCode\s+(\d+)/);
    expect(match).not.toBeNull();
    expect(Number.isInteger(Number(match[1]))).toBe(true);
  });
});
