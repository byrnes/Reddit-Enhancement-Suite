# Safari macOS Alpha QA Checklist

Use this checklist for the current Safari alpha. It is intentionally focused on the parts of the port that are still most likely to be wrong.

## Already Confirmed

These flows have already been manually verified on the current alpha:

- Settings page opens
- RES loads on `old.reddit.com`
- Toolbar CSS toggle works
- `showImages` works
- Infinite scroll works

If a change does not touch startup, page action behavior, or media expansion, these only need a quick spot-check.

## Test Setup

- macOS version:
- Safari version:
- RES Safari build/version:
- Test account:
- Test profile: regular / private
- Install method: local build / packaged app

## Fast Smoke Pass

Run these first on every Safari-focused change:

- [ ] Install or update the Safari bundle successfully
- [ ] Open `old.reddit.com` and confirm RES loads without obvious startup errors
- [ ] Open the settings page
- [ ] Toggle subreddit CSS from the toolbar
- [ ] Open a few expandos with `showImages`
- [ ] Trigger infinite scroll on a subreddit or listing page

## Remaining High-Risk Validation

### 1. Service worker wake and idle behavior

- [ ] Let Safari sit idle long enough for the background worker to go cold
- [ ] Confirm the first toolbar click after idle still works
- [ ] Confirm the first permission request after idle still works
- [ ] Confirm the first auth flow after idle still works
- [ ] If testing restore, confirm restore-triggered migrations still complete after idle
- [ ] Watch for unexpected first-action failures or console errors during those actions

### 2. Private browsing correctness

- [ ] Open a private Safari window with the extension enabled
- [ ] Open RES Troubleshooter and confirm private browsing is detected correctly
- [ ] Confirm Troubleshooter shows sane `resolved` and `source` values
- [ ] Confirm `autoHide` does not start running in the private-window boot path before private state resolves
- [ ] Confirm visited-link state does not leak back into normal browsing
- [ ] Confirm read-comment or monitored-post state does not leak back into normal browsing
- [ ] Confirm subreddit-visit tracking does not leak back into normal browsing
- [ ] Confirm private and non-private tabs do not cross-talk through multicast behavior

### 3. Downloads and history-backed behavior

- [ ] Click a media download button and confirm Safari either downloads or opens a clear Safari-native save/view path
- [ ] For third-party media URLs, treat “opens in a new tab / browser-native save path” as expected alpha fallback unless it is confusing or broken
- [ ] Confirm the download flow does not silently no-op
- [ ] Confirm visited-link behavior does not throw console errors when media is expanded
- [ ] If using filteReddit visited/comments-opened filters, confirm they still behave sensibly or degrade cleanly

### 4. Permissions and denial flows

- [ ] Grant a requested permission and confirm the feature starts working
- [ ] Deny a requested permission and confirm the feature fails cleanly
- [ ] Confirm denied permissions do not cause prompt loops or repeated broken state
- [ ] Confirm permission state persists across Safari restart when expected

### 5. Backup, restore, and auth providers

- [ ] Open each provider auth flow you care about
- [ ] Confirm popup auth completes successfully when allowed
- [ ] Confirm canceling auth leaves RES usable
- [ ] Restore from a valid backup and confirm migrations complete
- [ ] Confirm restore failures surface clearly instead of leaving settings half-applied

### 6. Night mode

- [ ] Confirm Safari does not offer the location-based automatic night mode option
- [ ] Confirm a stale saved `automatic` value is reset to `none`
- [ ] Confirm user-defined night mode hours still toggle night mode correctly
- [ ] Confirm system-color-scheme night mode follows Safari's reported color scheme
- [ ] Confirm manual night mode controls still work

### 7. Clean install and restart sanity

- [ ] Confirm the extension survives Safari restart
- [ ] Confirm settings and core startup still work after restart
- [ ] If practical, confirm the wrapper still enables cleanly on a second machine or profile

### 8. Alpha polish checks

- [ ] If the settings page fails to load, confirm the current error UI is understandable enough for alpha testing
- [ ] Watch for any Safari foreground action that appears to hang forever instead of succeeding or failing clearly

## Issue Notes

For any failure, capture:

- Exact page or flow
- What you expected
- What happened instead
- Whether it reproduces after refresh
- Whether it reproduces after Safari has been idle
- Whether it reproduces in a private window
- Any obvious console or Xcode log text

## Test Run Notes

| Date | Build | Safari | Profile | Result | Notes / Issues |
| --- | --- | --- | --- | --- | --- |
|  |  |  | regular / private | pass / fail / partial |  |
