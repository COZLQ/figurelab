# Release preparation report

Date: 2026-11-09. Candidate: v0.1.0. Status: ready for repository upload.

## Clean source validation

Publication files were copied into a new directory without node_modules, build output, private configuration, or Git metadata. The following were run there with Node.js 24.22.1 and pnpm 11.25.0:

| Check | Result |
| --- | --- |
| Frozen-lockfile installation | Passed; package cache reused and package metadata policy checks completed online |
| pnpm typecheck | Passed |
| pnpm test | 48 tests passed |
| pnpm check:release | Passed |
| pnpm build | Passed |
| Production startup | HTTP 200 on the application and AI-configuration status route |
| README development startup | HTTP 200 |
| Clean provider configuration | No credentials present |

The original editor continued to use its normal local address. Smoke tests used a separate port, and their server processes were stopped afterwards.

## Materials

- English and Chinese README; MIT license; contribution and security guidance.
- Issue forms, pull-request template, and CI workflow. Workflow YAML was parsed and the three pinned action references were checked.
- Three illustrative starter projects plus the walkthrough's real generated/edited project, each with JSON, native SVG, and white-background PNG.
- A 27-second actual-app key-step walkthrough, supplied as MP4 and looping GIF. Waiting is shortened and the edit is disclosed.
- Project JSON files passed the application schema. SVG files parsed as XML, PNG dimensions/backgrounds were checked, and demonstration frames were visually reviewed.

## Source-file audit

The publication check rejected a synthetic credential and a deliberately broken link in a temporary probe. The probe was then removed. Final candidate files passed common credential-pattern checks and local Markdown link checks. Local environments, dependency payloads, build caches, raw recordings, temporary tools, and runtime logs are excluded.

This audit is a practical release check, not a comprehensive security assessment.

## Still external to this preparation

The repository has not been uploaded, no release has been published, and GitHub Actions has not run remotely. A hosted demo URL will be added only after deployment. External vector-editor compatibility remains a separate check.
