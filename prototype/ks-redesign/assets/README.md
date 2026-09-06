# KS redesign prototype assets

This directory contains approved, web-optimized assets for the isolated Top + Isonoura redesign prototype.

## Top Hero

Approved visual direction:
- sunrise ocean scene
- one surfer in the water
- dark navy / blue-black overall tone with warm sunrise highlights
- no embedded title, logo, UI, or other text in the image itself
- HTML/CSS supplies all page text and overlays

Committed responsive assets:
- `hero-surf-mobile.avif`
- `hero-surf-mobile.webp`
- `hero-surf-desktop.avif`
- `hero-surf-desktop.webp`

The mobile and desktop files are separate optimized crops from the same approved sunrise/surfer scene. AVIF is the primary format and WebP is the fallback. The desktop fallback is intentionally lightweight because the Hero keeps a dark overlay and is used as a full-viewport background.

The prototype CSS already references these filenames, so no runtime image generation or third-party photo is required.

## Isonoura Hero

Do not reuse the Top Hero as the Isonoura Hero.

The Isonoura page still requires one Isonoura-specific approved image. Until that asset is approved/imported, keep the current designed fallback rather than using an unrelated spot photo.

## Safety

Do not add unlicensed third-party photography, secrets, private runtime data, or production backups to this directory.
