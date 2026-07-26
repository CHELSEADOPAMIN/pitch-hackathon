# biginstance 部署交接

当前 PoC 部署在 `/home/ubuntu/work/aisho/pitch-hackathon`，公网 API 为
`https://aisho.claw.a2a.ing`。Oracle 入站仅需保留 `80/443`；不要开放
`8787`。Node 仅监听 `127.0.0.1:8787`，由 Nginx 反向代理。

## 后端部署

```bash
cd /home/ubuntu/work/aisho/pitch-hackathon
/usr/local/bin/npm ci
cp deploy/biginstance/aisho-server.env.example .env
chmod 600 .env
# 填写 .env，禁止提交真实凭据

/usr/local/bin/npm run db:push
/usr/local/bin/npm run db:seed
/usr/local/bin/npm run build --workspace @pinch-voice/server

sudo install -m 0644 deploy/biginstance/aisho-pinch.service \
  /etc/systemd/system/aisho-pinch.service
sudo systemctl daemon-reload
sudo systemctl enable --now aisho-pinch
```

安装 Nginx 配置前，主机必须已存在覆盖 `*.claw.a2a.ing` 的证书：

```bash
sudo install -m 0644 deploy/biginstance/aisho.claw.a2a.ing.nginx \
  /etc/nginx/sites-available/aisho.claw.a2a.ing
sudo ln -s /etc/nginx/sites-available/aisho.claw.a2a.ing \
  /etc/nginx/sites-enabled/aisho.claw.a2a.ing
sudo nginx -t
sudo systemctl reload nginx
curl -fsS https://aisho.claw.a2a.ing/health
```

预期健康检查为：

```json
{ "status": "ok", "pinch": "ok" }
```

## EAS Android preview

EAS 项目归属 `@crokily/pinch-voice-shop`。在 EAS `preview` 环境中配置：

- `EXPO_PUBLIC_API_BASE_URL=https://aisho.claw.a2a.ing`
- `EXPO_PUBLIC_PINCH_API_BASE_URL=https://api.getpinch.com.au/test`
- `EXPO_PUBLIC_PINCH_API_VERSION=2020.1`
- `EXPO_PUBLIC_PINCH_PUBLISHABLE_KEY`：Pinch test publishable key

从 `apps/mobile` 构建可独立安装的 APK：

```bash
cd /home/ubuntu/work/aisho/pitch-hackathon/apps/mobile
/usr/local/bin/npx --yes eas-cli@latest whoami
/usr/local/bin/npx --yes eas-cli@latest build \
  --platform android \
  --profile preview
```

`preview` 是独立包，不依赖 USB、Expo Go 或本机 Metro。

## 已知阻塞：Android 卡在 `RESTORING SESSION`

EAS preview APK 已在此前未安装过本应用的另一台 Android 手机上验证：APK 可以
正常安装、启动并渲染 React 界面，但首屏持续显示 `RESTORING SESSION`。
先前的白屏来自安装异常，不再作为应用启动故障的证据。

该画面发生在任何后端、Pinch 或 OpenAI 请求之前。`HomeScreen` 仅在本地
Zustand persist 从 AsyncStorage 恢复完成后才进入登录页：

```text
session-store.ts 创建 store 并自动开始异步 hydration
  -> useStoreHydrated() 首次读取 hasHydrated()
  -> React effect 注册 onFinishHydration()
  -> hydration 完成后进入 LoginScreen
```

当前 `useStoreHydrated()` 存在事件竞态：如果 AsyncStorage 在首次读取
`hasHydrated() === false` 之后、effect 注册完成监听之前完成 hydration，
完成事件会被错过，组件内的 `hydrated` 将永久保持 `false`。全新安装时存储为空，
读取可能很快完成，因此同样可能触发；这不是旧 session 或重装残留导致的。

另一个永久等待分支是 AsyncStorage 读取或 JSON 解析失败。当前启动状态没有
hydration error、超时或重试出口，所以失败时仍只显示旋转状态。

已排除的方向：

- APK 包含 AsyncStorage 原生模块，不是 EAS 漏打包。
- `aisho-pinch.service`、Nginx 和公网 HTTPS 均正常。
- `https://aisho.claw.a2a.ing/health` 返回
  `{"status":"ok","pinch":"ok"}`。
- `8787` 继续只监听 `127.0.0.1`；无需在 Oracle 入站规则中开放。
- 本 PR 没有修改 session store、hydration hook 或首屏状态机。

建议由移动端作者在注册 hydration listeners 后立即重新读取一次
`hasHydrated()` 以补偿已完成事件，并增加 hydration error/重试状态；也可以使用
`skipHydration` 后在组件挂载时显式调用 `rehydrate()`。本交接只记录问题，不修改
原移动端实现。
