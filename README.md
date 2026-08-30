# JP Cuts website

A password-protected, no-index working preview with one shared content model, owner editing, approved JP photography, and three temporary layouts. Don's selected visual direction will replace the temporary layout switcher without changing the content/editor foundation.

1. The Cut Record
2. JP in the Chair
3. The Open Chair

Private preview: <https://dev.jpcuuts.com/>

Editor: <https://dev.jpcuuts.com/admin/>

## Architecture

- React and Vite render the public site and editor.
- D1-backed email/password sessions protect the complete preview origin, including direct content and media URLs.
- One content record drives the working layouts and will carry into the selected design.
- The public layouts are mobile-first; the design switcher collapses to one compact control on phones.
- A Cloudflare Worker serves the app, content API, authenticated editor API, and uploaded media.
- D1 stores users, sessions, current content, and revision history.
- Resend sends password-reset links from the verified `parabolos.com` domain. Its API key is a Worker secret and is never stored in source.
- A private R2 bucket stores uploaded images and videos; the Worker validates and serves them.
- Booking goes to JP's Calendly. This app does not store card data or manage availability.

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

- The editor supports shared copy, services, booking/event links, the temporary preview headlines, the editable About JP bio and verse, public social/contact links, hero and portrait images, a before/after pair, gallery slots, one uploaded video, and one featured Instagram reel.
- Instagram reels use a clean poster that opens Instagram. An uploaded featured video plays natively without Instagram's feed interface.
- The public preview omits JP's phone number; event inquiries use `jp@jpcuuts.com`.
- Images must be JPEG, PNG, WebP, or AVIF and no larger than 6 MB.
- Videos must be MP4 or WebM and no larger than 15 MB.
- Images require alt text before upload.
- Empty optional sections stay hidden.
- Published content writes a new revision; simultaneous stale saves are rejected.

## Media source

JP approved the selected client, wedding, and team photographs in the shared Dropbox project folder. Optimized derivatives belong in `public/media/defaults`; the source originals remain untouched.

## Account handoff and recovery

- Owners sign in with their email address and password.
- The login screen links to `/forgot-password/`, where the user requests a reset link by email. Normal sign-in never uses email OTP.
- The public response does not reveal whether an account exists. Requests are throttled by hashed email and IP keys.
- Reset links expire after 30 minutes and work once. The raw token stays in the URL fragment, is moved into the reset form in the browser, and is never sent in a GET request or stored in D1.
- D1 stores only the token hash. A successful reset atomically consumes the token, revokes existing sessions, and invalidates older unused tokens.
- The user must complete a fresh login after resetting the password.
- `/claim/` remains an operator-assisted fallback for an existing private recovery code, but it is not linked from the login screen.
- The owner can add another owner from the editor after confirming the person's email address.

Deployment requires the `RESEND_API_KEY` Worker secret. Apply D1 migrations before deploying:

```sh
npm run cf:migrate:remote
wrangler secret put RESEND_API_KEY
npm run cf:deploy
```
