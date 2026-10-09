# 漂流瓶：匿名投递与私密收件箱

访客有两种独立选择：打开自己的邮件客户端写邮件，或直接在网页投递漂流瓶。第二种不要求访客注册、不要求提供邮箱；昵称和回复线索均可留空。只有服务器接受了来信，页面才显示投递成功。失败时保留正文，允许重试，不会自动打开邮件客户端，也不会把浏览器本地存储当成主人的收件箱。

本次已经实现 Supabase 数据库投递、主人登录、私密来信列表、未读/已读、刷新和页面打开时每 20 秒检查新信。当前 `js/config.js` 的 Supabase 配置为空，所以**还没有连接真实云端收信账号**；完成下面的设置后才会真正收到匿名来信。

## 连接 Supabase

1. 在 [Supabase](https://supabase.com/) 创建项目。
2. 在 SQL Editor 运行本目录的 [`message-inbox.sql`](message-inbox.sql)。它支持原 README 的 `bottles` 表，增加 `read_at` 和 `message_hosts`，替换旧漂流瓶访问策略。
3. 在 Auth / Authentication 的 Users 中创建自己的主人账号，设置邮箱和密码。如果使用邀请/注册方式，先完成邮件确认。这个邮箱只用于主人登录，访客无需邮箱。
4. 复制该 Auth 用户的 **UUID**，在 SQL Editor 单独运行：

   ```sql
   insert into public.message_hosts (user_id)
   values ('替换为自己的-Auth-用户-UUID'::uuid)
   on conflict (user_id) do nothing;
   ```

5. 复制项目 URL 和公开 **publishable key**，填入 `js/config.js`。沿用原字段名 `anonKey`，它同时支持新 publishable key 和旧 anon JWT：

   ```js
   supabase: {
     url: "https://YOUR-PROJECT.supabase.co",
     anonKey: "sb_publishable_YOUR_PUBLIC_KEY"
   },
   ```

6. 打开 `message.html`，投递一封不填写联系方式的测试信；然后打开 `inbox.html`，用主人账号登录，确认收到该信并可以标记已读。部署到 GitHub Pages 后使用 HTTPS。

publishable / anon key 可以出现在静态前端；**secret / service_role key 不可以**。访问限制由数据库 RLS 和权限控制。新 key 只放在 `apikey` 请求头；主人登录获得的用户 JWT 才放在 `Authorization: Bearer` 中，参见 [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)。

## 私密权限与旧数据

SQL 会移除 `bottles` 和 `message_hosts` 的所有旧策略、表级和列级客户端权限，再明确授权：

- 未登录访客只能插入 `name`、`contact`、`text`；不能读取任何来信，也不能设置 `approved`、`reply`、`read_at`、ID 或时间戳。
- 只有 `message_hosts` 明确列出的 Auth UUID 可以读取来信及联系方式，或更新 `read_at`。
- 其他正常登录的账号读不到来信；仅“登录成功”不等于主人。收件箱也会检查服务端主人资格。
- 前端不能增删主人、删除信件、改写正文或公开发布来信。

原 README 曾允许匿名读取 `approved=true` 的瓶子；本次 SQL 会取消那项云端公开读取权限，已有数据仍保留。公开的漂流瓶示例可独立放在 `data/bottles.js`，只有已获得同意、人工挑选的内容才应加入这个文件。新来信默认私密，收件箱不会把它们自动加入公开展示。

RLS 和 SQL grants 共同决定权限，不能只靠隐藏页面或前端检查，参见 [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)。本次本地测试使用 REST mock；真实云端数据库尚未配置，上线前需要实际验证上述权限。最小验收如下：

| 账号/操作 | 预期 |
| --- | --- |
| 未登录，投递普通正文 | HTTP 成功，主人收件箱出现新信 |
| 未登录，GET `bottles`（包括 `contact`） | 权限拒绝 |
| 未登录，在 POST 中附带 `approved=true` 或 `read_at` | 权限拒绝 |
| 非主人登录，打开 `inbox.html` | 显示无主人权限 |
| 非主人 JWT 直接 GET `bottles` | 空数组，不泄露任何来信 |
| 主人 JWT 读取来信和更新 `read_at` | 成功 |
| 主人 JWT 更新 `text`、`approved` 或插入 `message_hosts` | 权限拒绝 |

前端正文限制为 2–500 字符，与旧数据库一致；名字最多 60，回复线索最多 120。请求 12 秒超时。不要在正式 Supabase 项目运行一次性的绕过 RLS 或全公开读取策略。

当前蜜罐、等待时间与 60 秒冷却只在浏览器执行，不能阻挡绕过页面直接调用 REST 的垃圾留言。公开开放前，建议在投递接口前加服务端限流与 Turnstile 验证。网络中断时也可能出现「服务器已保存但客户端未收到确认」，当前会保留草稿并说明无法确认；重试可能产生重复信件，后续可加唯一提交 ID 去重。

## 主人登录与通知

登录使用 Supabase 官方 Auth REST 的 password grant 和 refresh-token grant，参见 [Supabase Auth API 定义](https://github.com/supabase/auth/blob/master/openapi.yaml)。会话保存在当前标签页的 `sessionStorage`，不可用时退回内存；密码不会保存。令牌到期前会刷新。退出会清除本页会话，并尝试撤销对应服务端刷新会话；网络失败时会明确提示。

收件箱每 20 秒轮询，接近实时，但不保证精确 20 秒（后台标签页可能被浏览器节流）。桌面通知只在主人点击“开启桌面通知”并许可后使用；通知只显示新信数量，避免在锁屏展示私信正文。**关闭页面后不会继续推送**，刷新页面后需要再次开启本页通知。需要关页也能收到时，应使用下面的服务端推送架构。

## 不使用邮箱，免费推到本地的方案

建议先使用已实现的私密收件箱；之后增加数据库写入后的服务端推送：

```text
匿名投递 → 数据库保存 → 数据库 webhook / 服务端函数
                           → Telegram Bot 私聊通知
                           或 ntfy 的受保护主题 → 手机 / 桌面客户端
```

- [Telegram Bot API](https://core.telegram.org/bots/api)：主人先向自己的 bot 发一条消息取得私聊 ID。服务端保存 bot token 与目标 chat ID，成功入库后推送“有新漂流瓶”和收件箱链接。bot token 不能放进静态前端。本次没有创建 bot、配置 webhook 或真实发送通知。
- [ntfy](https://docs.ntfy.sh/)：可用本地/桌面订阅客户端。私密留言不要投到公开可猜的主题；使用带认证的私有主题或自托管，并在服务端保存凭证。托管免费档的私有认证与额度应按启用时的套餐核实。本次没有建立主题或真实发送通知。
- 浏览器 Web Push / Service Worker 能在页面关闭时推送，但需要服务端发送、用户授权和推送订阅管理，并不只是给静态页面加一个通知按钮。

这些推送只负责提醒；数据库保留原信，推送暂时失败也不会丢失来信。建议通知只带数量/链接，正文与联系方式留在私密收件箱。

## 免费方案的实际限制

[Supabase 免费项目](https://supabase.com/docs/guides/platform/free-project-pausing)可能因连续 7 天数据库活动不足被自动暂停；暂停期间不能可靠收信，需到 Dashboard 恢复。这对低访问量的个人留言页尤其需要留意，不应承诺永不间断的免费实时收信。

若希望长期低成本运行，可将投递 API 迁移为 **Cloudflare Worker + D1**，主人入口使用 Cloudflare Access 或自己实现验证，服务端接收信件并推送 Telegram/ntfy。D1 有免费读写和存储额度，见 [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)；Worker 也有独立额度。它需要一个独立部署的 Worker，不是 GitHub Pages 自身能保存私信，本次没有建立 Cloudflare 账号、数据库或部署。

若只想不要求访客邮箱、仍把信送进自己的邮件收件箱，也可以继续配置 `formEndpoint`（例如 Formspree）。此时直接提交表单，联系方式仍可为空，但来信进入表单服务/邮箱，不能用本页的 Supabase 私密收件箱读取。两项同时配置时优先 Supabase；Supabase 失败不会偷偷切换服务或邮件。
