# PWA public release checks

Production manifest and service worker were already present before this change; the default branch did not retain their source. The manifest preserves the existing application identity and icon paths. The worker no longer caches any network resources and removes only the old KS PWA versioned caches. Public top-level surf pages display an explicit 503 when the network is unavailable. Other routes, iframe requests, third-party resources and API requests are not intercepted.

Before manual release:
- Run `node tests/pwa.test.cjs` with Node 20+.
- Back up and compare production manifest.json and sw.js with current live sources; do not replace newer concurrent edits. Verify the four PNG icon paths, MIME and actual dimensions.
- Deploy only manifest.json and sw.js as necessary through the approved manual process, with rollback.
- Verify HTTPS, JavaScript MIME, worker registration/activation and scope, manifest identity, all 14 surf page links, Android Chrome installation, iOS Safari home screen addition and disconnected/reconnected behavior. Confirm current wave and wind data and no stale values on reconnect.
- Preserve top, individual page files, current ranking, API, LINE and DNS settings. Do not claim store publication or push notification support.
