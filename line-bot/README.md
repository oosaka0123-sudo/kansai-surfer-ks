# LINE group welcome bot

This directory is isolated from the Kansai Surfer KS website.

Purpose:
- receive LINE Messaging API webhooks;
- verify the raw request with HMAC-SHA256;
- react only to `memberJoined` events from a normal LINE group;
- issue a short-lived stateless channel access token only when needed, then reply once with the fixed rules / self-introduction guidance.

## Safety

- No existing Kansai Surfer site file is modified by this bot.
- `config.php` is never committed.
- Channel secret and channel access token must stay in GitHub Actions secrets.
- The staging workflow uploads only to `/nami/ks-line-bot/`.
- It never mirrors or deletes remote files.
- Production `/kansai` is not touched by this staging workflow.

## Required repository secrets for staging

Existing:
- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

New:
- `KS_LINE_BOT_CHANNEL_ID`
- `KS_LINE_BOT_CHANNEL_SECRET`

After staging is verified, the intended test webhook URL is:

`https://nami.rss7.net/ks-line-bot/webhook.php`

A separate explicit production deployment must be reviewed before anything is uploaded under `/kansai`.
