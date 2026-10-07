# LINE group welcome bot

This directory is isolated from the Kansai Surfer KS website.

Purpose:
- receive LINE Messaging API webhooks;
- verify the raw request with HMAC-SHA256;
- welcome new members of the normal LINE group;
- detect `#自己紹介` posts, plus template posts beginning with `ニックネーム：`, and keep a private server-side ledger;
- track observed members as introduction pending / completed / left;
- notify the registered operator when 20 introductions are waiting for Note export;
- notify the operator when the oldest unreflected introduction reaches 30 days;
- generate a Note-ready batch of up to 20 introductions;
- keep the existing LINE announcement area free for other use.

## Operator commands

The operator uses a 1:1 chat with the OA BOT.

- 状態 — observed member / introduction / Note counts
- 未投稿 — observed members without an introduction
- ノート用 — return the current unreflected batch, up to 20 people
- ノート反映済み — mark the current batch as copied to the LINE Note
- ヘルプ — command help

The first operator is enrolled with a one-time registration code. The plain code is never committed.

## Runtime state

Runtime state is stored in state.php on the isolated server directory. It is not committed and is not uploaded by CI. Direct HTTP access executes the PHP file and does not expose the returned data.

The bot stores only data needed for this feature:
- LINE group ID;
- LINE user ID;
- display name when available;
- observed/joined time;
- latest self-introduction text;
- Note reflected / pending state;
- active / left state.

If a self-introduction message is unsent, the matching saved introduction is deactivated when the webhook event is received.

## 20 people or 30 days

A Note reminder is sent to the registered operator when either condition is met:
- 20 unreflected introductions accumulate; or
- the oldest unreflected introduction reaches 30 days.

The 20-person check runs immediately when introductions arrive. The 30-day check is triggered by a small daily GitHub Actions job.

## Safety

- No existing Kansai Surfer site file is modified by this bot.
- config.php, state.php, and cron_key.php are never committed.
- The staging workflow uploads only isolated LINE bot runtime files to /nami/ks-line-bot/.
- It never mirrors or deletes the Kansai Surfer site.
- Production /kansai is not touched by this staging workflow.
- LINE Notes cannot be created or edited by Messaging API, so Note export intentionally remains a final manual copy/paste step.

## Staging endpoint

https://nami.rss7.net/ks-line-bot/webhook.php

A separate explicit production deployment must be reviewed before anything is uploaded under /kansai.
