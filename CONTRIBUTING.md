# Contributing to FigureLab

Contributions to graph editing, readable previews, vector export, accessibility, documentation, and compatibility are welcome.

中文使用说明见 [README.zh-CN.md](README.zh-CN.md)。反馈问题时请移除密钥和未公开研究数据。

## Set up

Use Node.js 24.x and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

AI configuration is optional for development. Unit tests mock provider responses and do not need real credentials.

## Validate a change

```sh
pnpm typecheck
pnpm test
pnpm check:release
pnpm build
```

Stop the development server before building in the same checkout. For diagram changes, also inspect the browser and check the affected project-save or export flow.

Add tests when they protect a meaningful behavior, such as undo recovery, graph validation, or SVG bounds. Documentation and cosmetic edits generally do not require new unit tests.

## Pull requests

Describe the user-visible problem and resulting behavior. Include relevant validation and a screenshot for visual changes. Keep changes focused and respect the existing document schema.

- Preserve editable objects and graph relationships.
- Keep provider credentials out of documents, logs, tests, screenshots, and browser storage.
- Use deterministic mocks for provider tests; real API calls require the operator's own configuration.
- Mark uncertainty in scientific examples rather than inventing findings.
- Record third-party assets and their licenses.

Use the issue templates for reproducible bugs or concrete feature requests. Security-related handling is described in [SECURITY.md](SECURITY.md).
