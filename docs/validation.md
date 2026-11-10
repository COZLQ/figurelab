# Validation record

Validated locally on 2026-11-09 with Windows, Node.js 24.22.1, pnpm 11.25.0, and the dependency versions pinned in pnpm-lock.yaml.

## Completed application checks

- TypeScript checks and 48 automated tests.
- Production build in an isolated checkout directory.
- Browser editing, connections, undo, file download/import, and autosave restoration.
- SVG XML structure: native text, module groups, and connection groups, with no embedded screenshots.
- PNG export with Chinese text, symbols, complete boundaries, and white background.
- Export regression cases: negative coordinates, diagrams moved away from the origin, long edge labels, invalid XML control characters, and large raster dimensions.
- AI graph validation, empty/truncated/refused output, provider errors, cancellation, and missing credentials.
- Real DeepSeek generation of a four-step material research workflow, followed by editing, undo, and project download.
- Preview zoom, pan, fit, expanded view, actual waiting time, retry actions, and preservation of earlier results after failures.

Local deterministic provider fixtures were used for repeated interface checks, without extra real model requests.

## Publication-specific checks

The release preparation also checks clean installation/startup, candidate-file exclusions, common credential patterns, local documentation links, and example documents. Results are recorded in the [release-preparation report](release-report.md).

## Verification limits

The GitHub Actions workflow has not run remotely before repository publication. Linux/macOS behavior and compatibility with external vector editors have not been exhaustively verified. Structural validation cannot establish scientific correctness.
