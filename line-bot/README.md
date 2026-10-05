# LINE group bot

This directory is isolated from the Kansai Surfer KS website.

## Features

- Verifies LINE webhook signatures with HMAC-SHA256.
- Welcomes new members in a normal LINE group.
- Remembers groups the official account has joined.
- Every Saturday at 19:00 JST, posts an anonymous **「明日どこ行く？」** destination poll.
- Choices: 磯ノ浦 / 生見 / 国府の浜 / 小松 / 伊勢方面 / 未定 / 行かない.
- Votes are one-person-one-vote. Tapping another destination replaces the previous vote.
- User names are never stored or shown. The runtime vote file stores only an HMAC hash derived from the LINE user ID.
- At 21:00 JST on Saturday, posts only the aggregate headcount by destination.

## Runtime files

The server creates these under `line-bot/data/`:

- `groups.json`: active LINE group IDs needed for push delivery.
- `votes.json`: anonymous voter hashes and destination choices.
- `sent.json`: idempotency records that prevent duplicate scheduled posts.

These files are runtime-only and are not committed.

## Required repository secrets

Staging FTP:
- `KS_NAMI_FTP_USER`
- `KS_NAMI_FTP_PASSWORD`

Production FTP:
- `KS_PROD_FTP_USER`
- `KS_PROD_FTP_PASSWORD`

LINE Messaging API:
- `KS_LINE_BOT_CHANNEL_ID`
- `KS_LINE_BOT_CHANNEL_SECRET`

The LINE credentials are used only by GitHub Actions to generate an untracked `config.php` during deployment. They are never committed.

## Endpoints

Staging:
- `https://nami.rss7.net/ks-line-bot/webhook.php`
- `https://nami.rss7.net/ks-line-bot/weekly_poll.php`

Production:
- `https://kansai.rss7.net/line-bot/webhook.php`
- `https://kansai.rss7.net/line-bot/weekly_poll.php`

The scheduler endpoint requires an HMAC-derived request header and is idempotent per group/date/mode.

## LINE console

The Messaging API channel must have **Allow bot to join group chats** enabled, and the Webhook URL must point to the production webhook after production deployment.

## Safety

- No existing Kansai Surfer site file is modified by the LINE bot deploy workflows.
- Production deployment uploads only the isolated `/kansai/line-bot/` files.
- Runtime `data/` is preserved and never mirrored/deleted by the workflow.
