# Pinch Voice Shop

Android 优先的语音无感购物 MVP：顾客用自然语音让 AI 看商品、维护购物车并确认结账；Pinch 测试环境完成真实绑卡和即时扣款；店员端每 3 秒看到已支付订单。

## MVP 边界

真实链路：

- OpenAI Realtime WebRTC 双向语音与 `shopping_agent` 工具调用
- 手机静默拍照、压缩后交给视觉 agent 匹配已 seed 商品
- Pinch 原生卡 tokenisation、持久 payment source、realtime payment
- 服务端购物车、一次性报价、明确确认、稳定 nonce 和订单落库
- 店员订单列表轮询

演示用 mock：

- 用户名即登录，不含密码、验证码或权限系统
- 单商家与固定商品目录
- 顾客/店员角色切换和人工用户名核验

此项目只允许连接 Pinch `test` 环境。不要使用真实银行卡，也不要部署成公开生产服务。

## 结构

```text
apps/mobile  Expo SDK 57 / React Native Android 客户端
apps/server  Hono / Drizzle / OpenAI / Pinch 服务端
```

所有长期凭据只在服务端读取。APK 仅包含自家 API 地址和 Pinch publishable key；卡号与 CVC 由 App 直接提交给 Pinch，绝不经过自家服务端。

## 本地启动

要求 Node.js 22+、JDK 17、Android SDK，以及 Android 真机或模拟器。WebRTC 原生模块无法在 Expo Go 中运行，必须使用 development build。

```bash
npm install
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env.local
```

填写 `.env` 中的服务端凭据；填写 `apps/mobile/.env.local` 中的公开配置。Android Emulator 访问本机服务使用 `http://10.0.2.2:8787`；真机需要改为同一局域网内电脑的 HTTPS 或 LAN 地址。

首次初始化空数据库：

```bash
npm run db:push
npm run db:seed
```

分别启动服务端和 Metro：

```bash
npm run dev:server
npm run dev:mobile
```

首次生成并安装 Android development build：

```bash
cd apps/mobile
npx expo prebuild --platform android
npx expo run:android
```

也可以使用 EAS development profile：

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform android
```

## 演示流程

1. 输入一个新用户名，后端创建 Pinch test payer。
2. 使用 Pinch 官方测试卡 `4242 4242 4242 4242`、任意未来有效期和 CVC 完成绑卡。
3. 允许相机和麦克风，建立 Realtime 会话。
4. 拿起 seed 商品并自然地说“把这个加入购物车”。
5. 可继续询问购物车或移除商品。
6. 说“结账”；AI 先复述服务端报价，只有明确确认后才会扣款。
7. 切换到店员端，确认订单在一次轮询周期内出现。

## 质量检查

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

演示验收还需要在目标 Android 机型上连续跑通 5 次，并实测相机方向、静音快门、通话中拍照和扬声器回声消除。

## 安全说明

这是刻意省略认证与 RBAC 的黑客松 PoC，客户端提交的 `userId` 可被冒用，店员订单接口也没有生产级授权。部署或分享前必须轮换开发过程中使用过的 OpenAI、Pinch 与数据库凭据，并在生产化时加入真实身份、持久化 payment-attempt、webhook 对账、限流与审计。
