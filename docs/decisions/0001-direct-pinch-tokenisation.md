# 0001 — Android 直接调用 Pinch Tokenisation

状态：已接受（2026-07-25）

## 决定

Android MVP 使用路线 B：原生卡片表单直接向 Pinch 测试环境发送 `POST /tokens`。

```text
Android 原生表单
  → Pinch POST /test/tokens（卡号、有效期、CVC、publishable key）
  ← 短期 token
  → 自有后端 POST /api/payment-source（仅 userId + token）
  → Pinch POST /test/payers/{payerId}/sources
  ← 持久 sourceId
```

本项目不实现 WebView/CaptureJS。只有用户明确改变方案时，才重新评估其他路线。

## 已验证事实

- 当前 Pinch 测试账号调用 `/test/tokens` 返回 HTTP 200。
- 请求字段为 `publishableKey`、`sourceType`、`cardNumber`、`cvc`、整数 `expiryMonth`、整数 `expiryYear` 与 `cardHolderName`。
- Pinch Application Secret、OAuth token、OpenAI 标准密钥和数据库连接串只允许存在于服务端环境。

## 不变量

- App 只允许包含 Pinch publishable key。
- 卡号与 CVC 不得发送到自有后端、AsyncStorage、日志、崩溃分析或数据库。
- token 创建成功后必须立即发送到后端并换成 payer 专属 source。
- MVP 只能连接 Pinch `/test`，不得接受真实银行卡。
- 表单成功后立即清空内存中的卡片字段。
