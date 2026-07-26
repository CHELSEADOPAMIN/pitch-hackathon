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

## 已知阻塞：Android 启动白屏

首个 EAS preview APK 能安装并启动 Activity，但 React 根实例没有完成初始化，
界面保持白屏。白屏后按实体键会命中 React Native
`ReactActivityDelegate.onKeyDown`，其中 `mReactDelegate` 仍为 `null`。

当前证据指向原移动端依赖/启动链，而非上述部署配置：

1. Expo SDK 57 强制使用 New Architecture。
2. `expo-doctor` 唯一失败项是 `react-native-webrtc` 未验证 New Architecture。
3. 首屏入口存在以下静态导入链，登录页出现前就会加载 WebRTC 原生模块：

   ```text
   CustomerScreen -> useRealtimeShopping -> realtime-session -> react-native-webrtc
   ```

后续应先采集应用冷启动阶段的完整 `adb logcat`，再由移动端作者验证
`react-native-webrtc@124.0.8` 与 Expo SDK 57 / React Native 0.86 的兼容性，
或将 WebRTC 延迟加载以隔离根因。本交接不包含白屏修复。
