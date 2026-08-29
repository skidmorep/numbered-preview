# Numbered / JP Cutz preview

A password-protected, no-index design preview with one shared content model and three switchable skins:

1. The Cut Record
2. JP in the Chair
3. The Open Chair

Public preview: <https://numbered-preview-dev.skidmore.workers.dev/>

Editor: <https://numbered-preview-dev.skidmore.workers.dev/admin/>

## Architecture

- React and Vite render the public site and editor.
- D1-backed email/password sessions protect the complete preview origin, including direct content and media URLs.
- One content record drives all three skins.
- The public layouts are mobile-first; the design switcher collapses to one compact control on phones.
- A Cloudflare Worker serves the app, content API, authenticated editor API, and uploaded media.
- D1 stores users, sessions, current content, and revision history.
- A private R2 bucket stores uploaded images and videos; the Worker validates and serves them.
- Booking remains with the selected hosted booking provider. This app does not store card data or manage availability.

## Local development

```sh
npm install
npm run cf:migrate:local
npm run build
wrangler dev
```

Run the release checks:

```sh
npm run lint
npm test
npm run build
node scripts/visual-check.cjs
```

Remote visual and editor checks require an owner session or the existing owner credentials and test-video path.

## Content and media rules

- The editor supports shared copy, services, booking/event links, the three creative headlines, hero and portrait images, nine gallery slots, one uploaded video, and one featured Instagram reel.
- Instagram reels use a clean poster that opens Instagram. An uploaded featured video plays natively without Instagram's feed interface.
- The public preview omits JP's phone number; event inquiries use the configured web link.
- Images must be JPEG, PNG, WebP, or AVIF and no larger than 6 MB.
- Videos must be MP4 or WebM and no larger than 15 MB.
- Images require alt text before upload.
- Empty optional sections stay hidden.
- Published content writes a new revision; simultaneous stale saves are rejected.

## Preview-only assets

The bundled haircut photographs came from JP's public Booksy listing for concept work. Confirm permission and replace them with JP's approved files before a production launch.

## Account handoff and recovery

- Owners sign in with their email address and password.
- The login screen links to `/forgot-password/` for first-time setup and password recovery.
- Recovery uses a private, single-use code rather than email OTP. An administrator issues the code for one exact account and delivers it through an approved private secret-sharing path.
- Codes are stored only as hashes, expire after 24 hours, and become invalid after use.
- A successful reset revokes existing sessions and older unused codes. The user must then complete a fresh login; the setup session is not accepted as login proof.
- The owner can add another owner from the editor after confirming the person's email address.
