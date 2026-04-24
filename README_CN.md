<div align="center">

# Defuddle Proxy

[![Express](https://img.shields.io/badge/Express-5-000000.svg?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-WTFPL-FF4136.svg)](http://www.wtfpl.net/)

**自托管 Defuddle 解析代理 — API Key 认证 · 用量统计 · 管理后台**

[English](README.md) | 中文

</div>

自托管 [Defuddle](https://github.com/kepano/defuddle) 解析代理服务。兼容 Defuddle 官方 API 风格，返回 Markdown + YAML frontmatter，提供 API Key 管理、用量统计和管理后台。

## 功能特性

- **解析代理** — 兼容 Defuddle 官方 API 风格，返回 Markdown + YAML frontmatter
- **API Key 管理** — 创建、重命名、删除 Key，支持 `sk-` 前缀密钥
- **管理后台** — 暗色主题，Key 管理 + 域名排行 + 用量统计
- **安全防护** — CSRF / XSS / timing-safe 比较 / rate limit / cookie 加固

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js + TypeScript (strict mode) |
| 服务器 | Express 5 |
| 数据库 | SQLite (better-sqlite3, WAL mode) |
| 模板 | EJS（暗色主题） |
| 解析 | Defuddle + linkedom + undici |

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
# 修改 docker-compose.yml 中的 ADMIN_PASSWORD 和 SESSION_SECRET
docker compose up -d
```

生产环境请务必修改 `ADMIN_PASSWORD` 和 `SESSION_SECRET`。若使用 HTTPS，取消 `COOKIE_SECURE` 的注释。

### Nix / NixOS 部署

在 flake inputs 中添加：

```nix
inputs.defuddle-proxy.url = "github:27Aaron/defuddle-proxy";
```

#### NixOS Module

```nix
{
  imports = [ inputs.defuddle-proxy.nixosModules.default ];

  services.defuddle-proxy = {
    enable = true;
    host = "0.0.0.0";
    timezone = "Asia/Shanghai";
    # 密钥（生产环境建议使用 environmentFile）
    environmentFile = "/run/secrets/defuddle-proxy.env";
    # 或直接设置（警告：会存入 /nix/store，全局可读）
    # sessionSecret = "你的随机密钥";
  };
}
```

`environmentFile` 内容：

```env
ADMIN_PASSWORD=你的安全密码
SESSION_SECRET=你的随机密钥
```

**NixOS 选项：**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `enable` | `false` | 启用服务 |
| `package` | flake 构建 | Defuddle Proxy 包 |
| `port` | `3000` | 监听端口 |
| `host` | `"127.0.0.1"` | 绑定地址，外部访问用 `"0.0.0.0"` |
| `dataDir` | `/var/lib/defuddle-proxy` | 数据库目录 |
| `adminUsername` | `"admin"` | 管理员用户名 |
| `adminPassword` | `"changeme"` | 管理员密码。建议用 `environmentFile` |
| `sessionSecret` | `null` | Session 加密密钥。建议用 `environmentFile` |
| `cookieSecure` | `false` | HTTPS 时设为 `true` |
| `timezone` | `"UTC"` | 时区，如 `"Asia/Shanghai"` |
| `user` / `group` | `"defuddle-proxy"` | 服务用户/组 |
| `environment` | `{ }` | 额外环境变量 |
| `environmentFile` | `null` | 密钥文件（KEY=VALUE 格式） |

服务以 systemd 运行，含安全加固（`ProtectSystem`、`PrivateTmp`、`NoNewPrivileges`）。

#### Home Manager

**Linux**（systemd 用户服务）：

```nix
{
  imports = [ inputs.defuddle-proxy.homeManagerModules.default ];

  services.defuddle-proxy = {
    enable = true;
    environmentFile = "/path/to/secrets.env";
  };
}
```

**macOS**（launchd agent）—— 配置相同，Home Manager 自动识别平台并使用 launchd。

**Home Manager 选项：**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `enable` | `false` | 启用服务 |
| `package` | flake 构建 | Defuddle Proxy 包 |
| `port` | `3000` | 监听端口 |
| `host` | `"127.0.0.1"` | 绑定地址 |
| `dataDir` | `~/.local/share/defuddle-proxy` | 数据目录 |
| `adminUsername` | `"admin"` | 管理员用户名 |
| `adminPassword` | `"changeme"` | 管理员密码。建议用 `environmentFile` |
| `sessionSecret` | `null` | Session 加密密钥。建议用 `environmentFile` |
| `cookieSecure` | `false` | HTTPS 时设为 `true` |
| `timezone` | `"UTC"` | 时区 |
| `environment` | `{ }` | 额外环境变量 |
| `environmentFile` | `null` | 密钥文件（KEY=VALUE 格式） |

#### 开发环境

```bash
nix develop
```

> 支持 `x86_64-linux`、`aarch64-linux`、`x86_64-darwin`、`aarch64-darwin` 四平台。

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

| 状态码 | 含义 |
|--------|------|
| 400 | URL 缺失或无效 |
| 401 | API Key 缺失或无效 |
| 403 | API Key 已禁用 |
| 429 | 请求频率超限（100次/分钟） |
| 502 | 页面解析失败 |

## 管理后台

访问 `http://localhost:3000/admin` 进入管理后台。

- **API Keys** — 创建、重命名、删除 Key，查看每个 Key 的调用日志和每日统计
- **域名排行** — 按调用次数排序的域名统计，点击查看详情
- **分页浏览** — 所有列表支持分页

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `HOST` | `127.0.0.1` | 监听地址，Docker 部署设为 `0.0.0.0` |
| `ADMIN_USERNAME` | `admin` | 管理后台用户名 |
| `ADMIN_PASSWORD` | `changeme` | 管理后台密码（**生产环境必须修改**） |
| `SESSION_SECRET` | `dev-secret` | Session 加密密钥（**生产环境必须修改**） |
| `DB_PATH` | `./data/defuddle.db` | SQLite 数据库路径 |
| `NODE_ENV` | — | 设为 `production` 启用安全检查 |
| `COOKIE_SECURE` | `false` | 仅 HTTPS 时设为 `true` |
| `TZ` | `UTC` | 时区，设为 `Asia/Shanghai` 使用北京时间 |

生产环境启动时，如果 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 仍为默认值，服务将拒绝启动。

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
nix/modules/
├── nixos.nix             # NixOS 系统级模块
└── home-manager.nix      # Home Manager 用户级模块
views/
├── login.ejs             # 登录页
├── dashboard.ejs         # 主面板（Keys + 域名排行）
├── key-stats.ejs         # Key 统计详情
├── domain-stats.ejs      # 域名统计详情
└── layout-nav.ejs        # 导航栏
```

## 安全说明

- Timing-safe API Key 比较，防止时序攻击
- 所有状态变更请求启用 CSRF 保护
- 通过 Content-Type 头和输入净化防止 XSS
- 速率限制（100 次/分钟/IP）
- 管理后台 Session 使用 HttpOnly + Secure Cookie
- Cookie 签名防篡改
- 生产模式拒绝使用默认凭据启动

## 许可证

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License
