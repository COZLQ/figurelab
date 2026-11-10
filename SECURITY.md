# Security and data handling

FigureLab v0.1 is intended for local use or a controlled private environment. It does not include account authentication, per-user quotas, or a public-service abuse protection layer.

## Credentials

Session API keys are held in page memory. They are sent to the local generation route and then to the endpoint configured by the operator. They are not written to project JSON, browser storage, or model output. Refreshing clears session configuration.

Optional server credentials belong in an ignored `.env.local` file or the hosting environment. Do not prefix keys with `NEXT_PUBLIC_`.

Do not publish a shared server key on an unrestricted endpoint. Public deployment requires an appropriate access-control and usage-limit design.

## Data sent to a provider

The generation request sends the entered research description and the app's graph-format instructions. It does not automatically attach the current canvas. The provider controls API charges and its own data policies.

Use non-sensitive examples when sharing recordings or bug reports. Exported figures and downloaded project files contain the research content they describe.

## Model output

The app validates graph structure before producing a diagram. The model does not supply executable markup. Redirects to another provider endpoint are rejected, and a per-request endpoint cannot borrow the server's API key.

Graph validation does not establish scientific correctness. Authors must review the generated content.

## Reporting

Never include a live API key or unpublished sensitive research in a public issue. If a key was exposed, revoke it through the provider.

For a vulnerability involving credential handling, use GitHub private vulnerability reporting if the repository owner has enabled it. Otherwise, open a sanitized issue requesting a private contact channel without publishing exploit details or credentials.

## Scope of automated checks

`pnpm check:release` checks candidate source files for forbidden local payloads, common credential patterns, and broken local Markdown links. It is a release aid, not a guarantee that every possible sensitive datum or vulnerability has been detected.
