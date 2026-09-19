# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

Refresh controls: manual refresh stays available; auto refresh is an explicit switch, off by default, 60 seconds when enabled and visible. Do not overlap reads or bind session receipts from refresh.

Project connection management belongs in dsh settings.section (Obsidian 项目). Saving may only update the plugin connection config, never notes, repository files or read receipts. Preserve authentication, same-origin checks, path validation and stale-config rejection.

Keep an explicit 修改连接 action in each settings project row alongside deletion. Sidebar deletion belongs on the same row as the project selector, not a separate row.
