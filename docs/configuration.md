# AI configuration / AI 配置

Manual editing, templates, saving, and exports work without AI credentials.

手动编辑、模板、保存与导出无需模型密钥。

## Session connection / 本次会话

Open **AI 生成 → 模型连接**. Fill:

| Field | Meaning | Default |
| --- | --- | --- |
| API 地址 | Provider base URL; a /v1 suffix or full /chat/completions endpoint is accepted | https://api.deepseek.com |
| 模型名称 | Exact model identifier from your provider | deepseek-flash |
| API Key | Your own provider credential | Empty |
| JSON 输出模式 | Request a JSON object response when supported | On |

The key stays in page memory and is cleared by refresh. It is sent to the local generation route and then to the selected provider. It is not saved in project files or browser storage.

密钥仅保留在页面内存，刷新后需重填。请求经过本地生成接口，再发送给所选择的服务商；密钥不会写入图表文件或浏览器存储。

## Optional local environment / 可选本机配置

Copy `.env.example` to `.env.local` in the project root and supply your own values. Restart the local service after changing configuration.

将根目录的 `.env.example` 复制为 `.env.local`，填写自己的配置后重启服务。

| Variable | Purpose |
| --- | --- |
| FIGURELAB_AI_BASE_URL | Base URL |
| FIGURELAB_AI_MODEL | Model identifier |
| FIGURELAB_AI_API_KEY | Server-side provider key |
| DEEPSEEK_API_KEY | Fallback key when FIGURELAB_AI_API_KEY is empty |
| FIGURELAB_AI_JSON_MODE | Set to false if the provider does not support response_format |
| FIGURELAB_AI_ALLOW_LOCAL_ENDPOINT | Explicit opt-in for a loopback HTTP model endpoint; normally unset |

Never put a secret in a `NEXT_PUBLIC_` variable. Do not commit `.env.local`.

不要给密钥变量加 `NEXT_PUBLIC_` 前缀，也不要提交 `.env.local`。

A per-request connection must supply its own key. It cannot change the destination of a server-side key.

本次会话使用自带密钥，不会借用服务端密钥转发到新地址。

## Troubleshooting / 常见问题

| Symptom | Next step |
| --- | --- |
| Not configured / 待配置 | Fill all three connection fields or configure the local environment |
| Access rejected / 权限错误 | Check the key and model access at your provider |
| Balance or quota error / 额度问题 | Check the provider account |
| Unsupported request / 请求不兼容 | Confirm the base URL and model; turn off JSON mode if unsupported |
| Empty or invalid graph / 空结果或无效图形 | Simplify the description or retry manually |
| Timeout / 超时 | Cancel or retry later; the existing canvas is retained |

There are no automatic retries. Provider charges, availability, and data policies are set by the provider. Scientific claims still require author review.

没有自动重试；费用、可用性和数据政策以服务商为准，研究内容仍需作者核对。

Official references: [DeepSeek first call](https://api-docs.deepseek.com/), [JSON output](https://api-docs.deepseek.com/guides/json_mode/).

For hosting with shared credentials, read [SECURITY.md](../SECURITY.md).
