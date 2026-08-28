# Numbered / JP Cutz preview

A password-protected, no-index design preview with one shared content model and three switchable skins:

1. The Cut Record
2. JP in the Chair
3. The Open Chair

Public preview: <https://numbered-preview-dev.skidmore.workers.dev/>

Editor: <https://numbered-preview-dev.skidmore.workers.dev/admin/>

## Architecture

- React and Vite render the public site and editor.
- HTTP Basic Auth protects the complete preview origin, including direct content and media URLs.
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

Set `PREVIEW_PASSWORD` in `.dev.vars` before local Worker testing. Production stores it as a Cloudflare Worker secret. The preview username is `preview`.

Run the release checks:

```sh
npm run lint
npm test
npm run build
node scripts/visual-check.cjs
```

Remote visual and editor checks require `NUMBERED_PREVIEW_PASSWORD`. The editor check also requires the existing owner credentials and test-video path.

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

## Account handoff

The shared preview username is `preview`; its password is stored separately in the local macOS Passwords/Keychain entry for `numbered-preview-dev.skidmore.workers.dev`. The owner account is `skidmore@parabolos.com`, with a separate password stored in the same secret store. The owner can add JP from the editor after JP's email is confirmed. New editors must change their temporary password before publishing.
