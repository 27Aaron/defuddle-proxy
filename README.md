# Defuddle Proxy

自托管的 [Defuddle](https://defuddle.com) 解析代理服务，提供 API Key 认证、用量统计和管理后台。

## 功能

- **解析代理** — 兼容 Defuddle 官方 API 风格，返回 Markdown + YAML frontmatter
- **API Key 管理** — 创建、重命名、删除 Key，支持 `sk-` 前缀密钥
- **管理后台** — 暗色主题，Key 管理 + 域名排行 + 用量统计
- **安全防护** — CSRF / XSS / timing-safe 比较 / rate limit / cookie 加固

## 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 修改密码和密钥

# 开发模式（自动重载）
npm run dev

# 生产构建
npm run build
npm start
```

### Docker 部署

```bash
# 修改 docker-compose.yml 中的密码和密钥
docker compose up -d
```

生产环境请务必修改 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。若使用 HTTPS，取消 `COOKIE_SECURE` 的注释。

## API 使用

### 认证

通过 API Key 认证，支持两种方式：

```bash
# Bearer Header
curl http://localhost:3000/https://example.com \
  -H "Authorization: Bearer sk-your-api-key"

# Query Parameter
curl http://localhost:3000/https://example.com?key=sk-your-api-key
```

### 响应格式

返回 `text/plain`，内容为 Markdown + YAML frontmatter：

```yaml
---
title: "Example Page"
author: "John Doe"
site: "example.com"
source: "https://example.com"
domain: "example.com"
description: "Page description"
word_count: 1234
published: "2024-01-01"
---
Page content in Markdown...
```

### 错误响应

| 状态码 | 含义                       |
| ------ | -------------------------- |
| 400    | URL 缺失或无效             |
| 401    | API Key 缺失或无效         |
| 403    | API Key 已禁用             |
| 429    | 请求频率超限（100次/分钟） |
| 502    | 页面解析失败               |

## 管理后台

访问 `http://localhost:3000/admin` 进入管理后台。

- **API Keys** — 创建、重命名、删除 Key，查看每个 Key 的调用日志和每日统计
- **域名排行** — 按调用次数排序的域名统计，点击查看详情
- **Tab 分页** — 所有列表支持分页浏览

## 环境变量

| 变量             | 默认值               | 说明                                                |
| ---------------- | -------------------- | --------------------------------------------------- |
| `PORT`           | `3000`               | 服务端口                                            |
| `HOST`           | `127.0.0.1`          | 监听地址，Docker 部署需设为 `0.0.0.0`               |
| `ADMIN_USERNAME` | `admin`              | 管理后台用户名                                      |
| `ADMIN_PASSWORD` | `changeme`           | 管理后台密码（**生产环境必须修改**）                |
| `SESSION_SECRET` | `dev-secret`         | Session 加密密钥（**生产环境必须修改**）            |
| `DB_PATH`        | `./data/defuddle.db` | SQLite 数据库路径                                   |
| `NODE_ENV`       | —                    | 设为 `production` 启用安全检查和 cookie secure      |
| `COOKIE_SECURE`  | `false`              | 仅 HTTPS 时设为 `true`，让 cookie 只在 HTTPS 下传输 |
| `TZ`             | `UTC`                | 时区，设为 `Asia/Shanghai` 使用北京时间             |

生产环境启动时，如果 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 仍为默认值，服务将拒绝启动。

## 技术栈

- **Runtime**: Node.js + TypeScript (strict mode)
- **Server**: Express 5
- **Database**: SQLite (better-sqlite3, WAL mode)
- **Template**: EJS (shadcn 风格暗色主题)
- **Parsing**: Defuddle + linkedom + undici

## 项目结构

```
src/
├── index.ts              # 入口，Express 配置，代理路由
├── db/
│   └── index.ts          # SQLite 初始化，Schema，迁移
├── middleware/
│   ├── admin-auth.ts     # 管理后台 Session 认证
│   ├── api-auth.ts       # API Key 认证
│   └── csrf.ts           # CSRF 保护
├── routes/
│   └── admin.ts          # 管理后台路由（CRUD + 统计）
└── services/
    └── defuddle.ts       # Defuddle 解析服务
views/
├── login.ejs             # 登录页
├── dashboard.ejs         # 主面板（Keys + 域名排行）
├── key-stats.ejs         # Key 统计详情
├── domain-stats.ejs      # 域名统计详情
└── layout-nav.ejs        # 导航栏
```

## License

ISC
