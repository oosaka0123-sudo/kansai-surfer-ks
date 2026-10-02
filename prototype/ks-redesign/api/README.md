# LINE group member count API (prototype)

`line-group-count.php` returns the current member count of the LINE group used for
"普通のグループチャット" on the LINE Community page, fetched server-side from the
LINE Messaging API (`GET /v2/bot/group/{groupId}/members/count`). The browser never
calls the LINE API directly — it only calls this same-origin PHP endpoint.

## Configuration

Two values are required, read in this order: `config.secret.php` (gitignored, not
committed) first, then environment variables as a fallback.

| config.secret.php key   | Environment variable          |
|--------------------------|--------------------------------|
| `channel_access_token`   | `LINE_CHANNEL_ACCESS_TOKEN`    |
| `group_chat_group_id`    | `LINE_GROUP_CHAT_GROUP_ID`     |

Copy `config.secret.sample.php` to `config.secret.php` in this directory and fill in
real values there, or set the two environment variables on the host — whichever fits
how this environment is deployed. Never commit real values; `config.secret.php` is
already excluded by the repo's `.gitignore` (`config.secret.php` pattern).

The LINE official account / bot used for `channel_access_token` must already be a
member of the target group, or the LINE API call will fail.

## Behavior

- Missing configuration → `{"status":"unconfigured"}`, no count is invented.
- LINE API call fails / unexpected response → `{"status":"error"}`.
- Success → `{"status":"ok","count":<int>}`.

`line-community.js` shows "人数取得中…" while the request is in flight and falls back
to "取得できませんでした" for both `unconfigured` and `error` — it never fabricates a
number.
