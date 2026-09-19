# Sidebar design QA · 2026-09-19

Source visual truth: `docs/assets/dsh-sidebar-ui-v1.png` (1536 × 1024).
Implementation: `http://127.0.0.1:5178`, screenshots `docs/assets/sidebar-memory.png`, `sidebar-tasks.png`, `sidebar-detail-v2.png`.
Viewport: desktop 1280 × 720 CSS px; captured PNGs 1280 × 720, density 1. Source is a three-state board with approximately 453 × 850 panels; implementation is one 400 × 720 sidebar next to a clearly marked host illustration. Comparison is of the corresponding sidebar regions, not the surrounding board/host, and is proportional rather than pixel-exact.

## Comparison history

1. Source and `sidebar-detail.png` were opened together. P2: weak detail heading hierarchy, small supporting type, underline tabs drifted from the segmented source. Original logo had been replaced by a text mark.
2. Fixed headings, supporting type, purple segmented tabs; restored the original raster mark using a CSS crop of the source image. Source and revised memory/detail captures were opened together for comparison.

## Findings

- Typography: system CJK sans; clear section headings and readable body. Source card copy is larger because its frame is wider. Footer provenance remains compact (10 px), a P3 polish opportunity.
- Layout: 20 px panel padding, compact cards, fixed footer and independently scrolling content. Taller content scrolls; essential controls stay accessible. Source board is not a literal host screenshot.
- Colors: white surface, pale gray borders, purple navigation, amber warnings retained. No fake connected/updated state.
- Assets: original raster logo retained without redrawing. P3: embedding the entire source image makes the plugin approximately 1.8 MB uncompressed; extract a dedicated logo asset before a bandwidth-sensitive release.
- Copy: deliberately adapted to implemented scope. Imported/offline and demo states are explicit. Original live-change count and source-opening buttons are omitted because those capabilities are not implemented. Task details preserve source text; only level-2 headings receive presentation styling. This is a functional v0.1 adaptation, not pixel-identical reproduction.

Focused comparison: header, segmented navigation, warning and detail headings inspected in the same source/revised screenshot inputs; text at native desktop resolution remained readable.

## Interaction evidence

- Memory → tasks → blocked filter → API detail → back; blocker, next action and acceptance present.
- Nonmatching search shows an empty result.
- Exported repository example imported through native file chooser: 2 notes, 1 planned task, Coordinator, 0/1 progress and export time visible.
- Malformed JSON schema shows error and retains the previous project.
- Browser error logs returned `[]` before the malformed-import check.
- Narrow width DOM check: CSS viewport 390 × 844, panel 390 × 844, document scrollWidth 390. Screenshot backend produced a scaled/padded capture (`sidebar-mobile.png`), so this is only a no-overflow DOM check; mobile visual fidelity is not certified.

## Implementation checklist / limits

- [x] Desktop visual corrections and key local interactions verified.
- [x] Python exporter and registration/cleanup tests.
- [x] Real dsh 0.1.5-rc.2 installation, restart, sidebar entry and demo interaction verified.
- [ ] Real-host file import: Chrome chooser automation rejected with Not allowed; native Computer Use permission unavailable.
- [ ] Hot reload and full host CSS visual audit.
- [x] Live project bridge and explicit per-session read receipts (v0.2, see below).
- [ ] Reliable narrow-viewport visual capture.

final result: passed

Scope of pass: desktop v0.1 UI adaptation and explicit offline import only. It does not certify real dsh integration, full planned functionality, or narrow-screen visual fidelity.

## v0.2 targeted verification

Actual dsh 0.1.5-rc.2 panel: `docs/assets/dsh-demo-live-v2.png`. Inspected cropped screenshot: project selector, connection status, tabs, note cards and refresh footer readable and contained within the host panel. Demo live read (2 notes / 1 task), polling after a file edit, failed read retaining old content, manual recovery and unbound-session task state verified. Demo files restored byte-for-byte; refresh created no receipts. This adds desktop live integration evidence; it does not certify hot reload, all host styles or narrow-screen fidelity.
