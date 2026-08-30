# The Chair design QA

## Target

- Don's four approved **The Chair** reference sheets.
- paul's override: warm tan is the dominant page surface; camo is a smaller, lighter accent.
- One responsive UI only. No design switcher.

## Comparison evidence

- `proof/the-chair/comparison-hero.png`
- `proof/the-chair/comparison-work.png`
- `proof/the-chair/comparison-services-about.png`
- `proof/the-chair/comparison-events-booking.png`
- Full-page captures at 390×844 and 1440×900 under `proof/the-chair/`.

## Pass 1

- **P1 · layout / typography:** The desktop hero constrained the editable headline too narrowly and wrapped “IN.” onto a third line. Fixed by preserving sentence breaks as two display lines and widening the desktop lockup.
- **P2 · color / brand accent:** The first camo dividers competed with the tan sections at full-page scale. Reduced both divider height and opacity.
- **P2 · proof quality:** The local fallback banner obscured the clean hero comparison. The visual harness now serves bundled content through the normal content response, so proof captures the real live state without changing product behavior.

## Final pass

- Typography preserves The Chair's outlined hero label, condensed display hierarchy, and blunt service/about/event headings.
- Warm tan owns the work, about, and final booking surfaces. Ink and olive provide bounded section contrast.
- Camo appears only in four narrow real-photo dividers sourced from JP's chair cape.
- Every target image role is filled with real JP/client photography; no CSS illustration or placeholder image remains.
- Desktop, tablet portrait, tablet landscape, and 390×844 touch layouts have no horizontal overflow or broken image.
- Booking remains visible above the fold on mobile and desktop.
- Mobile navigation, Calendly links, social links, and the before/after pointer and keyboard controls remain functional.
- Focus visibility, semantic buttons/links, alt text, reduced-motion behavior, and practical mobile tap targets are present.
- No design switcher or stale skin query is rendered.

## Release review

- The v2-to-v3 content migration preserves existing owner edits while selecting the approved Chair headline.
- Every field still exposed in the editor now renders on the public Chair site, including all featured-media types.
- A mobile CSS cascade that exposed a duplicate header booking button was fixed. The responsive harness now opens the menu and rejects tall, overlapping mobile headers.
- Lint, 18 Worker tests, the production build, four responsive Chair viewports, the authenticated foundation flow, and the high-severity dependency audit pass.

**final result: passed**
