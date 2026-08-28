# Design QA — mobile skin rebuild

## Reference and implementation states

Viewport: 426 × 923 CSS pixels. Don's 852 × 1846 PNGs were normalized to the same viewport before comparison.

| Skin | Reference | Implementation | Combined comparison |
| --- | --- | --- | --- |
| 01 — The Cut Record | `/Users/skidmore/.openclaw/workspace-don/output/jpcuuts-mobile-mockups-20260828/01-the-cut-record.png` | `proof/design-qa/implementation-cut-record.png` | `proof/design-qa/comparisons/compare-01.png` |
| 02 — JP in the Chair | `/Users/skidmore/.openclaw/workspace-don/output/jpcuuts-mobile-mockups-20260828/02-jp-in-the-chair.png` | `proof/design-qa/implementation-jp-in-chair.png` | `proof/design-qa/comparisons/compare-02.png` |
| 03 — The Open Chair | `/Users/skidmore/.openclaw/workspace-don/output/jpcuuts-mobile-mockups-20260828/03-the-open-chair.png` | `proof/design-qa/implementation-open-chair.png` | `proof/design-qa/comparisons/compare-03.png` |

Each combined image places the reference on the left and the implementation on the right. The implementation intentionally includes the password-protected preview's 48-pixel design switcher above the website.

## Iterations

1. Rebuilt the three designs on one shared React/content scaffold.
2. Removed a mobile cascade conflict that exposed the desktop booking button and displaced the menu.
3. Matched the Cut Record's compact vertical rhythm and forced the two-sentence headline break.
4. Matched the Open Chair's wide image crop and above-the-fold service density.
5. Replaced the Instagram iframe with a clean poster link while preserving native playback for uploaded video.
6. Confirmed the public surface contains no `tel:` or `sms:` links.

## Final findings

- P0: none.
- P1: none remaining.
- P2: none remaining.
- P3: JP in the Chair uses the strongest approved real finished-cut image currently available. Its intended JP-at-work image remains an asset replacement when JP supplies one.
- P3: Service prices use the current Booksy values instead of the mockups' illustrative values.

Automated capture checks passed for all three skins: exact active skin, three mobile switcher choices, no horizontal overflow, no phone/SMS links, no iframe, and one clean featured-reel poster.

**Final result: passed.**
