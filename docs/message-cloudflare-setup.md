# 漂流瓶：Cloudflare D1 收信与 Telegram 提醒

**当前状态（2026-10-10）：Cloudflare 已用现有 Google 账号完成 Wrangler 授权。欧洲区 D1 `message-inbox` 已创建，`0001_message_inbox.sql` 已在云端执行，Worker 已部署。主人自行设置的 `HOST_PASSWORD` 已生效，生产 API 已启用，网页已填写实际 API 地址。Telegram 和 Turnstile 暂未配置。**

- 收信 API：`https://quiet-shore-messages.quiet-shore-message-worker.workers.dev`
- D1 ID：`f17acea9-503f-4463-992a-a3351107670d`
- 主人登录标识：`chen.jia@tum.de`

下面的创建步骤供重新部署或迁移参考；当前账号请复用已有数据库，不要重复创建。

访客仍有两种方式：用自己的邮件客户端写邮件，或在网页直接投递漂流瓶。网页投递不需要访客注册或填写邮箱；昵称和联系方式可留空。来信保存在 D1，只有主人登录后能读取；Telegram 只提醒有新信并提供收件箱链接。

```text
访客网页 → Cloudflare Worker → D1 保存私信
                           → 持久通知任务 → Telegram 私聊提醒
主人 inbox.html → 登录 Worker → 读取私信、标记已读
```

网站页面继续放在 GitHub Pages；数据库和验证在独立 Worker 中运行。GitHub Pages 本身是静态 HTML/CSS/JavaScript 托管，不能独立执行本方案的写入与主人验证逻辑。[GitHub Pages 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## 1. 授权已有账号并准备 Wrangler

你已经有 Cloudflare 账号，可直接继续。运行下面的登录命令后，在打开的浏览器中用现有 Google 登录方式进入 Cloudflare，再确认 Wrangler 授权。Google 登录用于管理 Cloudflare；网站 `inbox.html` 目前仍使用独立的 `HOST_EMAIL` 和 `HOST_PASSWORD`，不会自动变成 Google 登录。

下面的命令从网站仓库根目录运行。需要 Node.js 与 pnpm；若未安装，可从 [Node.js 官方网站](https://nodejs.org/) 安装受支持的 LTS 版本。进入已经准备好的 Worker 目录：

```sh
cd services/message-worker
pnpm install --frozen-lockfile
pnpm exec wrangler login --scopes account:read user:read workers_scripts:write d1:write
pnpm exec wrangler whoami
```

Wrangler 是 Cloudflare 的官方 CLI；这里在 Worker 项目中安装，并用 `pnpm exec wrangler` 运行。仓库锁定了已验证的 Wrangler 版本。`whoami` 用于确认当前授权的是自己的账号。无需迁移现有 GitHub Pages 网站或另购域名。[Wrangler 安装文档](https://developers.cloudflare.com/workers/wrangler/install-and-update/)、[Wrangler 登录文档](https://developers.cloudflare.com/workers/wrangler/commands/general/#login)

## 2. 创建 D1 并应用数据库迁移

仍在 `services/message-worker` 目录中；如果尚未创建同名数据库，运行：

```sh
pnpm exec wrangler d1 create message-inbox
```

命令会返回数据库 UUID。在 `wrangler.jsonc` 中，将 D1 配置的 `database_id` 占位值替换为这次返回的实际 UUID，保留绑定名 `DB` 和数据库名 `message-inbox`：

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "message-inbox",
    "database_id": "填写实际数据库UUID",
    "migrations_dir": "migrations"
  }
]
```

然后建立线上数据库表：

```sh
pnpm exec wrangler d1 migrations apply message-inbox --remote
```

迁移文件已经放在 `migrations/0001_message_inbox.sql`，包括私信、主人会话、限流记录与通知任务。使用 `--remote` 才会迁移真正的云端数据库；本地数据库不能替代它。[D1 创建与迁移命令](https://developers.cloudflare.com/d1/wrangler-commands/)

## 3. 填写公开配置并设置主人密码

修改 `wrangler.jsonc` 的 `vars`：

```jsonc
"vars": {
  "ALLOWED_ORIGIN": "https://rosellecalyx.github.io",
  "HOST_EMAIL": "chen.jia@tum.de",
  "INBOX_URL": "https://rosellecalyx.github.io/inbox.html"
}
```

- `ALLOWED_ORIGIN` 是网页的 HTTPS origin，只包含协议与域名，不加页面路径或末尾斜杠。更换域名时一起修改。
- `HOST_EMAIL` 是主人登录时输入的身份标识。本方案不会向它发送登录验证邮件，也不依赖邮箱转发来信；访客无需邮箱。
- `INBOX_URL` 是 Telegram 提醒中的完整收件箱链接。如果网站后来放在项目子目录，需要改成实际可访问的路径。

主人密码使用 Worker secret：

```sh
pnpm exec wrangler deploy
pnpm exec wrangler secret put HOST_PASSWORD
```

第一次 `deploy` 用于创建 `quiet-shore-messages` Worker。此时还没有主人密码，API 会返回未配置（HTTP 503），不会接受来信或开放收件箱。随后在 `secret put` 的交互提示中输入一个独立的、至少 16 字符的随机长密码，并自行保存在密码管理器中。不要把密码写入 `vars`、前端、Git 仓库或聊天。

也可在 Cloudflare Dashboard 打开 `quiet-shore-messages` → **Settings** → **Runtime variables and secrets** → **Add variable**。选择 **Production**，Key 填 `HOST_PASSWORD`，Value 填独立密码，勾选 **Secret**，然后亲自点击 **Add 1 variable and deploy**。Key 是固定变量名，Value 是你以后登录收件箱所用的密码；不要在 Value 外添加引号。保存并部署后才会生效。

这里直接配置 `HOST_PASSWORD` secret；不需要另建 `HOST_PASSWORD_HASH` 或 `HOST_PASSWORD_SALT`。敏感值由 Cloudflare secret 保存，普通网页只知道 Worker 的公开地址。[Workers secrets 官方文档](https://developers.cloudflare.com/workers/configuration/secrets/)

## 4. 创建 Telegram bot 并获取自己的 chat ID

这一步由你在自己的 Telegram 和本机终端完成。暂时跳过也能使用 D1 私密收件箱，之后补上 Telegram secrets 即可开启提醒。

1. 在 Telegram 打开官方 [@BotFather](https://t.me/BotFather)，发送 `/newbot`，按提示选择 bot 名称和 username。BotFather 会给你 bot token；只保存在自己手里。[Telegram 官方创建教程](https://core.telegram.org/bots/tutorial)
2. 打开新 bot 的私聊，使用自己将要接收提醒的 Telegram 账号，点击 Start 或发送 `/start`。bot 需要先收到你的私聊消息。
3. 在本机终端运行下面的命令，token 在隐藏提示中输入；命令只打印私聊 chat ID，不打印 token 或聊天正文：

   ```sh
   python3 - <<'PY'
   import getpass
   import json
   import urllib.error
   import urllib.request

   token = getpass.getpass("Telegram bot token（隐藏输入）: ").strip()
   try:
       req = urllib.request.Request(
           "https://api.telegram.org/bot" + token + "/getUpdates",
           data=b"timeout=0", method="POST"
       )
       with urllib.request.urlopen(req, timeout=15) as response:
           result = json.load(response)
       ids = {
           item.get("message", {}).get("chat", {}).get("id")
           for item in result.get("result", [])
           if item.get("message", {}).get("chat", {}).get("type") == "private"
       }
       for chat_id in sorted(ids):
           print("private chat ID:", chat_id)
       if not ids:
           print("没有找到私聊；请先向这个 bot 发送 /start，再运行一次。")
   except urllib.error.HTTPError as error:
       print("Telegram 返回 HTTP", error.code, "；请检查 token。")
   except Exception:
       print("无法读取 Telegram 更新；请检查网络后重试。")
   PY
   ```

   对一个刚创建且只由你发送过 `/start` 的 bot，返回的私聊 ID 就是你的接收目标。不要把多个陌生人的 ID 当成目标。这里使用官方 `getUpdates` 读取 bot 的来信；新 bot 不需要额外 webhook。已有 webhook 的 bot 不能同时用 `getUpdates`，可为网站创建一个独立 bot。[Telegram getUpdates 文档](https://core.telegram.org/bots/api#getupdates)

4. 在 `services/message-worker` 目录，把 token 与上述 ID 设置成服务端 secrets：

   ```sh
   pnpm exec wrangler secret put TELEGRAM_BOT_TOKEN
   pnpm exec wrangler secret put TELEGRAM_CHAT_ID
   ```

   逐个在提示中输入。不要把这些值写进 `js/config.js`，不要贴到聊天或提交到 Git。创建 bot 和读取 chat ID 的步骤不会主动发送网站通知。

Telegram 默认 bot 消息在普通限额内不收费。本方案只向你自己的私聊发简短提醒，不需要启用付费广播。桌面或手机能否弹出提示也取决于 Telegram 客户端、网络和系统通知设置。[Telegram 免费消息与限额](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this)

## 5. 部署 Worker 并连接网页

仍在 Worker 目录：

```sh
pnpm exec wrangler deploy
```

部署成功后，Wrangler 会返回 `workers.dev` HTTPS 地址。复制它的**根地址**到网站 `js/config.js` 中的 `SITE.messageApi`；不要加 `/api/messages` 或 `/api/host`：

```js
messageApi: "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev",
supabase: { url: "", anonKey: "" },
```

这里只放公开的 Worker URL，不放任何密码或 bot token。配置 `messageApi` 后，漂流瓶与主人收件箱优先使用 Cloudflare；原 Supabase 字段可以保持为空。填写错误或请求失败时不会自动改投其他服务。

把修改后的网页部署到 GitHub Pages，之后打开：

- 投递页：[message.html](https://rosellecalyx.github.io/message.html)
- 主人收件箱：[inbox.html](https://rosellecalyx.github.io/inbox.html)

收件箱用 `HOST_EMAIL` 加 `HOST_PASSWORD` 登录。Cloudflare 账号是管理部署的账号；网页主人密码是本服务的收件箱密码，两者独立。

## 6. 验证真实送达

完成部署后，按下面的顺序验收：

| 操作 | 预期结果 |
| --- | --- |
| 不登录、不填写昵称或联系方式，投递普通正文 | 服务端保存成功后页面才显示送达并播放扔瓶动画 |
| 用主人邮箱标识和密码登录收件箱 | 能看到测试信与未读状态 |
| 将测试信标为已读，再刷新页面 | 已读状态仍保留 |
| 不登录直接读取主人接口 | 返回拒绝，不暴露私信 |
| 在另一浏览器提交新信 | 主人收件箱打开时，在轮询更新后出现 |
| 关闭收件箱页面，再提交一封新信 | Telegram 收到新信提醒及收件箱链接；登录后查看正文 |
| 暂时中断 Telegram 推送后恢复 | D1 原信仍在，待通知任务稍后重试；提醒可能延迟或重复 |

收件箱打开时每 20 秒检查新信，后台标签页可能被浏览器延后。网页上的桌面通知需要主人点击开启并允许；**关闭页面后这项网页通知不会继续运行**。关页提醒依赖服务端发送到 Telegram，原信始终以 D1 收件箱为准。

Cloudflare 投递使用稳定的 `submissionId`：在当前页面中，相同正文、昵称和联系方式的失败重试复用原 ID，服务端不会重复保存同一封信；同一 ID 对应不同内容时返回 HTTP 409。修改内容或重新打开页面会产生新的提交，因此这不是跨页面的永久去重。

## 运行行为与免费额度

新私信与通知任务在同一个 D1 batch 事务中保存，推送失败不会删除原信。配置 Telegram 后，Worker 会尝试及时发送简短提醒；每 5 分钟的 Cron Trigger 检查持久任务并处理已经到重试时间的项目，失败次数增加后会逐渐延长等待时间。通知只带新信数量和收件箱链接，正文、昵称与联系方式不会送到 Telegram。重试可能造成重复提醒，不承诺严格只通知一次。首次部署的 cron 配置传播可能需要最多约 15 分钟。[D1 batch 事务](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

Worker 已在服务端按 IP 摘要限流：匿名投递每 10 分钟最多 5 次，主人登录每 15 分钟最多 5 次，刷新会话每 15 分钟最多 30 次。它们使用固定时间窗，窗口交界处可能允许短暂突发。数据库保存 keyed HMAC 摘要，不保存原始 IP；共享网络下的多位访客会共用限额。

按 2026-10-09 查阅的官方免费方案：

| 服务 | 免费额度 |
| --- | --- |
| Workers | 每天 100,000 次请求 |
| Workers CPU | 普通免费请求默认每次最多 10 ms CPU 时间 |
| D1 读取 | 每天 5,000,000 行 |
| D1 写入 | 每天 100,000 行 |
| D1 存储 | 同一账号所有数据库合计 5 GB |

个人留言页通常用量较小，但限流、会话、索引和通知任务也会消耗读写额度，不能把“写一封信”直接等同于“一行配额”。D1 免费额度超限会返回错误；页面会保留正文，并提示未能确认送达。CPU 时间与等待网络返回的耗时不同，免费服务也不是无限资源。使用前可在 Cloudflare Dashboard 查看实际方案与用量。[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[D1 价格及超额行为](https://developers.cloudflare.com/d1/platform/pricing/)

## 可选：启用 Turnstile

前端 widget/token 获取与服务端 Siteverify 都已实现；基础收信可先只使用现有限流。要启用 Turnstile，在 Cloudflare 创建 widget，把 `rosellecalyx.github.io` 列入允许域名，取得对应的公开 sitekey 与 secret。

在网站 `js/config.js` 填写：

```js
turnstileSiteKey: "填写公开sitekey",
```

在 Worker 目录设置配套的服务端 secret：

```sh
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```

重新部署修改过的网页。两项必须成对配置：只设置服务端 secret，普通投递会因缺少 token 验证失败；只有前端 sitekey，服务端不会执行强制验证。前端采用 explicit render、暗色主题（`theme: "dark"`）、自适应尺寸（`size: "flexible"`）与 `action: "message"`；Worker 同时核验 token 成功状态、实际 hostname 与 `action`，过期后需要重新验证。[Turnstile 服务端验证文档](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)

本地自动化验证使用真实 SQLite 模拟 D1 绑定，并模拟 HTTP/Telegram 返回；Worker 14 项测试与前端相关 50 项测试已通过。云端数据库迁移和 Worker 部署已完成，生产 API 的同源预检返回 204，未登录读取私信返回 401，不支持公开读取，其他域名请求返回 403。Telegram 送达仍需配置并独立验收。
