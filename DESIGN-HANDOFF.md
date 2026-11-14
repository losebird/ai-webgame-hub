# 38efbe81-6c35-4cd3-a43f-d04787483d06 implementation handoff

This archive is the source of truth for turning the design into production code. Start from `index.html`, then preserve the visual system, responsive behavior, and interactions found in the exported files.

## Implementation target
- Build production UI from the exported design, not a loose reinterpretation.
- Preserve typography scale, spacing rhythm, color tokens, border radii, shadows, motion timing, and component states.
- Replace static placeholders only when the target app has real data or functional equivalents.
- Keep generated product UI free of OpenDesign chrome, preview labels, or design-process annotations.
- Treat this handoff as a visual contract: if implementation choices conflict, match the exported pixels and behavior first, then refactor internals.

## Source map
- Primary entry: `index.html`
- HTML screens detected: 16
- Stylesheets detected: 4
- Script/component files detected: 2
- Supporting assets detected: 107

## Responsive contract
Validate the implementation across this 2025–2026 viewport matrix:
- Mobile compact: 360×800
- Mobile standard: 390×844
- Mobile large: 430×932
- Foldable / small tablet: 600×960
- Tablet portrait: 820×1180
- Tablet landscape: 1024×768
- Laptop: 1366×768
- Desktop: 1440×900
- Wide desktop: 1920×1080

For responsive web exports, treat these as a modern breakpoint system for one adaptive web experience, not three fixed screenshots. Do not split responsive web into unrelated native app screens unless the project explicitly includes native targets. Use semantic layout thresholds, fluid `clamp()` type/spacing, and container queries where component width matters more than viewport width. Preserve any CSS media queries, container queries, fluid `clamp()` scales, and layout changes already present in the exported files.

## Design fidelity contract
- Extract reusable tokens before writing components: background, surface, foreground, muted text, border, accent, radius, shadow, spacing, type scale, and motion duration/easing.
- Map product screens, in-app modules/components, optional landing page, and optional OS widget surfaces before coding. Keep these surfaces separate in the target architecture.
- Match layout geometry: max-widths, gutters, grid columns, card proportions, sticky/fixed elements, and viewport-specific navigation.
- Preserve real copy, labels, and data shown in the export. Do not replace specific text with generic marketing filler.
- Preserve interactive affordances: hover, focus, pressed, disabled, loading, validation, copy/share, tab/accordion, modal/sheet, and keyboard states where present.
- Preserve accessibility semantics when converting: headings stay hierarchical, controls remain buttons/links/inputs, focus states stay visible.
- Do not keep prototype-only annotations, frame labels, or OpenDesign chrome in the production UI.

## CJX-ready UX contract
- Use `DESIGN-MANIFEST.json` as the machine-readable map for screens, app modules, OS widgets, landing pages, tokens, interactions, and viewport checks.
- Screen-file-first: when multiple user-facing surfaces exist, implement each HTML screen as its own route/file. Treat `index.html` as a launcher/overview when the manifest marks it that way, not as a combined final UI.
- If `landing.html`, app screens, platform screens, or OS widget files exist, preserve those boundaries in the target app instead of merging them into one page.
- A single self-contained `index.html` is acceptable only when the export truly contains one user-facing screen and its CSS/JS are structured enough to extract tokens, components, states, and behavior.
- If separate `css/` or `js/` files exist, treat them as source of truth for token/component/interactions before porting to React, Vue, SwiftUI, Compose, or another target stack.
- In-app modules/components are product UI blocks inside the app. OS widgets are home-screen/lock-screen/quick-access surfaces outside the app. Do not merge those concepts.

## Color and brand contract
- Use the exported design tokens and product/domain context as the color source of truth.
- Do not introduce warm beige / cream / peach / pink / orange-brown background washes unless they are already explicit brand/reference colors in the export.
- A stylesheet or design/token file was detected; inspect it for canonical color variables before choosing framework theme tokens.

## Implementation sequence for AI coding tools
1. Open `index.html` and `DESIGN-MANIFEST.json`; identify every screen file, launcher/overview file, app module, and interaction before coding.
2. If multiple HTML screens exist, map them to separate routes/surfaces first; do not merge `landing.html`, product app screens, platform screens, or OS widgets into one route.
3. Extract a token table from CSS/root styles and inline styles before building framework components.
4. Build product screens and domain-specific in-app modules from largest layout regions down to controls; avoid starting with isolated atoms that lose spatial intent.
5. Port responsive behavior across the modern viewport matrix and test each semantic breakpoint before cleanup.
6. Port interactions and states, then replace static placeholders only with real app data or functional equivalents.
7. Keep optional landing page and OS widget surfaces as separate surfaces if present.
8. Compare final screenshots against the export at 360×800, 390×844, 430×932, 820×1180, 1024×768, 1366×768, 1440×900, and 1920×1080 before declaring done.

## Entry points
- `browse.html`
- `community.html`
- `game-detail.html`
- `index.html`
- `login.html`
- `notify.html`
- `play.html`
- `post.html`
- `profile.html`
- `rankings.html`
- `register.html`
- `reset.html`
- `search.html`
- `settings.html`
- `user.html`
- `workshop.html`

## Styles
- `assets/fonts/fonts.css`
- `assets/jiwan-anime.css`
- `assets/jiwan-nes.css`
- `assets/jiwan-press.css`

## Scripts/components
- `assets/jiwan-api.js`
- `assets/jiwan-catalog.js`

## Assets and supporting files
- `3370c41a5ff55f7e14c232538cbe02cf.jpg`
- `assets/fonts/fusion-bold-pixel-12px-proportional-zh_hans.otf.woff2`
- `assets/fonts/fusion-bold-pixel-OFL.txt`
- `assets/fonts/fusion-pixel-12px-proportional-zh_hans.otf.woff2`
- `assets/fonts/fusion-pixel-OFL.txt`
- `assets/fonts/press-start-2p-OFL.txt`
- `assets/fonts/PressStart2P-Regular.ttf`
- `assets/jiwan-logo.svg`
- `assets/jiwan-pads.png`
- `assets/posters/2048.jpg`
- `assets/posters/2048.png`
- `assets/posters/a-dark-room.jpg`
- `assets/posters/agar-io.png`
- `assets/posters/akoben.jpg`
- `assets/posters/alchemy-2.jpg`
- `assets/posters/bayhaven.jpg`
- `assets/posters/beach-hamster.jpg`
- `assets/posters/becario.jpg`
- `assets/posters/bio-chaos.webp`
- `assets/posters/bitten.webp`
- `assets/posters/blameless.jpg`
- `assets/posters/boring-game.jpg`
- `assets/posters/breach.jpg`
- `assets/posters/clay-shooter.webp`
- `assets/posters/cookie-2.jpg`
- `assets/posters/cookie-clicker.jpg`
- `assets/posters/daedalus.jpg`
- `assets/posters/deep-state.webp`
- `assets/posters/diep-io.png`
- `assets/posters/duskline.jpg`
- `assets/posters/dustfall.jpg`
- `assets/posters/emberdeep.jpg`
- `assets/posters/evensong.jpg`
- `assets/posters/explora.webp`
- `assets/posters/f1-legends.webp`
- `assets/posters/fable-52.jpg`
- `assets/posters/fable-multiplayer.jpg`
- `assets/posters/feiche-3d.jpg`
- `assets/posters/fluff-bat.jpg`
- `assets/posters/forkline.jpg`
- `assets/posters/from-china.webp`
- `assets/posters/hanford-reach.jpg`
- `assets/posters/harvest-standoff.jpg`
- `assets/posters/hextech-aram.jpg`
- `assets/posters/ironvale.jpg`
- `assets/posters/jimao-cs.jpg`
- `assets/posters/krunker.jpg`
- `assets/posters/laps-1.jpg`
- `assets/posters/laps-2.jpg`
- `assets/posters/last-light-1.jpg`
- `assets/posters/last-light-2.jpg`
- `assets/posters/last-light-3.jpg`
- `assets/posters/lost-transmission.jpg`
- `assets/posters/misremember.jpg`
- `assets/posters/mothlight.jpg`
- `assets/posters/mustache-1.jpg`
- `assets/posters/mustache-2.jpg`
- `assets/posters/neon-stack.webp`
- `assets/posters/neoswarm.webp`
- `assets/posters/open-skies.jpg`
- `assets/posters/out-of-stamina.webp`
- `assets/posters/paperclips.jpg`
- `assets/posters/paperclips.png`
- `assets/posters/password-game.jpg`
- `assets/posters/pelican-bike.jpg`
- `assets/posters/pixel-cosmos.png`
- `assets/posters/pocket-soccer.jpg`
- `assets/posters/qingyun.jpg`
- `assets/posters/saltline-arcade.jpg`
- `assets/posters/saltline-online.jpg`
- `assets/posters/sams-pizza-1.png`
- `assets/posters/sams-pizza-2.png`
- `assets/posters/shuttle-strike.jpg`
- `assets/posters/skybell.webp`
- `assets/posters/slither.png`
- `assets/posters/sternenjaeger.jpg`
- `assets/posters/sublevel-07.jpg`
- `assets/posters/tidebell.jpg`
- `assets/posters/timber-target.webp`
- `assets/posters/transport-ship.jpg`
- `assets/posters/tuktuk.jpg`
- `assets/posters/veyl.webp`
- `assets/posters/warm-toy-room.jpg`
- `assets/posters/water-keeps.jpg`
- `assets/posters/watermelon.png`
- `assets/posters/we-fishing.jpg`
- `assets/posters/wukong-tiger.jpg`
- `assets/posters/wusuo-shanmen.jpg`
- `Clipboard-2026-11-13-at-17.46.13-1.png`
- `Clipboard-2026-11-13-at-17.46.13.png`
- `drawing-2026-11-13T05-11-19-690Z.png`
- `drawing-2026-11-13T05-15-59-110Z.png`
- `drawing-2026-11-13T05-42-12-220Z.png`
- `drawing-2026-11-13T05-49-35-010Z.png`
- `drawing-2026-11-13T07-24-43-086Z.png`
- `drawing-2026-11-13T07-31-39-845Z.png`
- `image-1.png`
- `image-2.png`
- `image-3.png`
- `image-4.png`
- `image-5.png`
- `image-6.png`
- `image-7.png`
- `image-8.png`
- `image-9.png`
- `image.png`
- `screenshot-2026-11-13T02-56-59-027Z.png`

## Coding checklist for AI tools
1. Inspect `index.html` and `DESIGN-MANIFEST.json` first and identify reusable components before coding.
2. Implement each user-facing screen file as its own route/surface; keep launcher, landing, app, platform, and OS widget files separate.
3. Extract design tokens into the target stack: colors, type scale, spacing, radius, shadows, and motion.
4. Implement layout with real 2025–2026 responsive breakpoints, fluid type/spacing, and container-query-aware component behavior; test with no horizontal overflow.
5. Preserve interactive controls, hover/focus/pressed states, form behavior, validation, and copy actions where present.
6. Implement domain-specific in-app modules with real states; do not flatten them into generic cards.
7. Keep landing page, product screens, and OS widget/quick-access surfaces separate when present.
8. Confirm the production result visually matches the exported design before refactoring internals.
9. Reject implementation shortcuts that flatten the design into generic cards, generic gradients, placeholder stats, or framework-default typography.
10. If a detail is ambiguous, keep the exported HTML/CSS/JS behavior rather than inventing a new pattern.
