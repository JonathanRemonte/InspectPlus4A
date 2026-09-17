# CI/CD

## What runs today

### `ci.yml` — on every push to `main`/`develop`/`feature/**`/`hotfix/**` and every PR
- `ci/install` — `npm ci`
- `ci/lint-typecheck` — `eslint`
- `ci/test` — `jest` (the same suite `.husky/pre-commit` already runs locally; this is the server-side backstop for a skipped or missing hook)
- `ci/commitlint` — PR-only, lints commit messages in the PR range

### `supabase-db.yml` — on push to `develop`/`feature/**`/`hotfix/**` and every PR
- Starts a local Supabase stack, resets the DB, runs `supabase test db`

### `eas-build.yml` — after `CI` finishes successfully on `develop` or `main`
- `develop` → `eas build --platform android --profile preview --non-interactive`
- `main` → `eas build --platform android --profile production --non-interactive`
- Triggered via `workflow_run` (not a plain `push` trigger) so a build only kicks off once lint/typecheck/test have all passed on that commit.
- Android only for now — iOS has no Apple Developer account/credentials configured yet (see below).

## EAS project

- Project: `@jonathanremonte/inspectplus` (id in `app.json` → `extra.eas.projectId`)
- Profiles (`eas.json`):
  - `development` — dev client, internal distribution
  - `preview` — internal distribution, used for `develop` builds
  - `production` — used for `main` builds, auto-incrementing build number
- **Native dependencies.** `@maplibre/maplibre-react-native` (map picker,
  since 2026-09-17) is autolinked at build time — nothing under `android/`
  is hand-edited for it. Any branch that adds it needs a fresh APK before
  Metro can load the app: an older APK fails at import with a
  missing-native-module error.

## One-time manual setup (not automated — do these once)

1. **`EXPO_TOKEN` repo secret.** Generate an Expo access token (expo.dev → account settings → Access Tokens), then:
   ```bash
   gh secret set EXPO_TOKEN
   ```
   Without this, `eas-build.yml` will fail at the `eas-cli build` step with an auth error.

2. **Android production signing.** `android/app/build.gradle` still points the `release` build type at the debug keystore — fine for local `expo run:android`, not fine for a real Play Store release. Run once, interactively, from a machine logged into the right EAS/Expo account:
   ```bash
   eas credentials
   ```
   and generate/upload a real Android keystore under EAS-managed credentials. Do this before the first `production`-profile build is expected to matter (e.g. before an actual Play Store submission), since EAS-managed credentials are what the cloud build profiles use — not the gradle file.

## Backward compatibility for older installed app versions

Already implemented, not deferred — see `docs/sync-contract.md`'s
"Backward Compatibility Rules" section for the full rationale:

- **Additive-only schema/RPC discipline** — a documented rule, not enforced
  by tooling.
- **App-side min-version gate** — `app_config.min_supported_app_version`,
  read by `assertAppVersionSupported` (`src/services/sync/appVersionGate.ts`)
  on every `runManagedSync` call. Blocks sync with a clear "update required"
  alert when the installed app is below the floor; never blocks offline app
  usage.

Still deferred, with an explicit trigger to revisit each:
- **Contract tests pinned to shipped app versions** — once a real version
  has actually shipped through this EAS pipeline, add fixtures to
  `supabase test db` replaying that version's exact payload shapes.
- **RPC versioning** (`push_changes_v2`, etc.) — only if a genuinely
  non-additive change becomes unavoidable despite the additive-only rule.
- **EAS Update (OTA)** — only after the min-version gate has been proven
  against a real release, since OTA can otherwise widen version skew faster
  than store releases would.

## Explicitly not set up yet

- **Store submission** (`eas submit`) — needs an Apple Developer Program membership + App Store Connect API key, and a Google Play Console service account JSON. Neither exists yet. Once they do, add `submit` profiles to `eas.json` and a submit step to the workflow.
- **iOS builds** — bundle identifier (`com.inspectplus`) is set so the app is ready, but no Apple credentials exist, so `eas-build.yml` doesn't attempt an iOS build. Add `--platform android,ios` (or a separate job) once Apple Developer access exists.
- **Staging Supabase project** — everything, including CI's `supabase db reset`, currently runs against a local ephemeral stack for tests, but real migrations still go straight to the one production Supabase project. A staging project + promotion workflow is a separate follow-up.
