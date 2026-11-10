# Release checklist / 发布清单

## Prepared locally

- [x] English and Chinese README.
- [x] MIT license and direct-dependency notices.
- [x] Configuration example without credentials.
- [x] Contribution guide, issue forms, and pull-request template.
- [x] GitHub Actions workflow prepared with read-only repository permission.
- [x] Application type checks, 48 tests, browser checks, and production build.
- [x] Final source-file and documentation-link audit.
- [x] Clean-install/startup smoke test from publication files.
- [x] Final review of demonstration media and examples.

Local results are recorded in the [release-preparation report](release-report.md). These checkboxes do not represent a remote CI result.

## When publishing to GitHub

1. Review the source archive and license.
2. Create the intended repository under the intended account.
3. Push the prepared source and confirm the first GitHub Actions run.
4. Add the repository description and topics.
5. Publish a v0.1.0 release using [prepared notes](releases/v0.1.0.md).
6. Add a real online-demo URL only after deployment is verified.
7. If enabling private vulnerability reports, configure that in repository settings.

Suggested description:

> Turn research descriptions into editable scientific diagrams. Local-first canvas, graph validation, and native SVG export.

Suggested topics: scientific-visualization, diagram-editor, research-tools, react-flow, nextjs, svg, typescript.

The current candidate has no hosted-demo URL and no published GitHub release. No repository owner or URL is fabricated in these materials.
