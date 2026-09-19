# Contributor instructions

- Keep this a small, standard-library-only Python CLI and Markdown workflow.
- Read README.md and docs/workflow.md before changing behavior.
- Never import personal Vault content, absolute user paths, credentials, or source-project data.
- The CLI must not write to the configured Obsidian project directory.
- Preserve explicit refresh, per-session snapshot SHA binding, and old snapshot archives.
- Validate changes with `python3 -m unittest discover -s tests -v`; test against temporary directories.
- Do not imply distributed locking, transactional writes, automatic enforcement, or semantic validation.
- User-facing examples must run without model accounts, network services, or Obsidian plugins.
- Default: do not commit or publish without a user request.

For agents using this tool in another project, merge docs/agent-instructions.md into that project's existing instructions.

## Sidebar implementation

- Python remains stdlib-only; sidebar/ is the optional React UI and dsh plugin.
- Preserve read-only imports. Do not equate UI refresh, snapshot freshness, and per-session SHA binding.
- Tasks use frontmatter status and owner; missing status is unknown, not inferred from prose.
- Validate exporter with the Python suite; in sidebar run npm run build, npm run build:plugin, npm test.
- Do not claim real dsh integration verified from the mock registration test alone.

- dsh receipt protocol: use session_context.py read with the actual host-provided session ID; never fabricate IDs or update another session's receipt. Preserve explicit snapshot refresh and expected-SHA checks before writes. Display refresh must never create receipts.
