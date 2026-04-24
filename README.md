<div align="center">

# Defuddle Proxy

[![Express](https://img.shields.io/badge/Express-5-000000.svg?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-better--sqlite3-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-WTFPL-FF4136.svg)](http://www.wtfpl.net/)

**Self-hosted Defuddle Parsing Proxy — API Key Auth · Usage Stats · Admin Dashboard**

[中文](README_CN.md) | English

</div>

Self-hosted [Defuddle](https://github.com/kepano/defuddle) parsing proxy service. Compatible with the official Defuddle API style, returns Markdown + YAML frontmatter, with API Key management, usage statistics, and an admin dashboard.

## Features

- **Parsing Proxy** — Compatible with Defuddle API style, returns Markdown + YAML frontmatter
- **API Key Management** — Create, rename, delete keys with `sk-` prefix
- **Admin Dashboard** — Dark theme, key management + domain ranking + usage statistics
- **Security** — CSRF / XSS / timing-safe comparison / rate limit / cookie hardening

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js + TypeScript (strict mode) |
| Server | Express 5 |
| Database | SQLite (better-sqlite3, WAL mode) |
| Template | EJS (dark theme) |
| Parsing | Defuddle + linkedom + undici |

## Getting Started

### Local Development

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env to change password and secret

# Development (auto-reload)
npm run dev

# Production build
npm run build
npm start
```

### Docker

```bash
# Modify ADMIN_PASSWORD and SESSION_SECRET in docker-compose.yml
docker compose up -d
```

Change `ADMIN_PASSWORD` and `SESSION_SECRET` in production. Uncomment `COOKIE_SECURE` when using HTTPS.

### Nix / NixOS

Add the flake to your inputs:

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
    # Secrets (use environmentFile for production)
    environmentFile = "/run/secrets/defuddle-proxy.env";
    # Or set directly (WARNING: stored in /nix store, world-readable)
    # sessionSecret = "your-random-secret";
  };
}
```

The `environmentFile` should contain:

```env
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-random-secret
```

**NixOS options:**

| Option | Default | Description |
|--------|---------|-------------|
| `enable` | `false` | Enable the service |
| `package` | flake package | Defuddle Proxy package |
| `port` | `3000` | Listening port |
| `host` | `"127.0.0.1"` | Bind address, use `"0.0.0.0"` for all interfaces |
| `dataDir` | `/var/lib/defuddle-proxy` | Database directory |
| `adminUsername` | `"admin"` | Admin username |
| `adminPassword` | `"changeme"` | Admin password. Prefer `environmentFile` |
| `sessionSecret` | `null` | Session encryption secret. Prefer `environmentFile` |
| `cookieSecure` | `false` | Set to `true` for HTTPS |
| `timezone` | `"UTC"` | Timezone, e.g. `"Asia/Shanghai"` |
| `user` / `group` | `"defuddle-proxy"` | Service user/group |
| `environment` | `{ }` | Extra environment variables |
| `environmentFile` | `null` | File with secrets (KEY=VALUE format) |

The service runs as a systemd service with security hardening (`ProtectSystem`, `PrivateTmp`, `NoNewPrivileges`).

#### Home Manager

**Linux** (systemd user service):

```nix
{
  imports = [ inputs.defuddle-proxy.homeManagerModules.default ];

  services.defuddle-proxy = {
    enable = true;
    environmentFile = "/path/to/secrets.env";
  };
}
```

**macOS** (launchd agent) — same config, Home Manager auto-detects the platform and uses launchd instead of systemd.

**Home Manager options:**

| Option | Default | Description |
|--------|---------|-------------|
| `enable` | `false` | Enable the service |
| `package` | flake package | Defuddle Proxy package |
| `port` | `3000` | Listening port |
| `host` | `"127.0.0.1"` | Bind address |
| `dataDir` | `~/.local/share/defuddle-proxy` | Database directory |
| `adminUsername` | `"admin"` | Admin username |
| `adminPassword` | `"changeme"` | Admin password. Prefer `environmentFile` |
| `sessionSecret` | `null` | Session encryption secret. Prefer `environmentFile` |
| `cookieSecure` | `false` | Set to `true` for HTTPS |
| `timezone` | `"UTC"` | Timezone |
| `environment` | `{ }` | Extra environment variables |
| `environmentFile` | `null` | File with secrets (KEY=VALUE format) |

#### Dev Shell

```bash
nix develop
```

> Supports `x86_64-linux`, `aarch64-linux`, `x86_64-darwin`, `aarch64-darwin`.

## API Usage

### Authentication

Authenticate via API Key, two methods supported:

```bash
# Bearer Header
curl http://localhost:3000/https://example.com \
  -H "Authorization: Bearer sk-your-api-key"

# Query Parameter
curl http://localhost:3000/https://example.com?key=sk-your-api-key
```

### Response Format

Returns `text/plain` with Markdown + YAML frontmatter:

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

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Missing or invalid URL |
| 401 | Missing or invalid API Key |
| 403 | API Key is disabled |
| 429 | Rate limit exceeded (100 req/min) |
| 502 | Page parsing failed |

## Admin Dashboard

Visit `http://localhost:3000/admin` to access the admin dashboard.

- **API Keys** — Create, rename, delete keys, view per-key logs and daily stats
- **Domain Ranking** — Domain stats sorted by request count, click for details
- **Pagination** — All lists support paginated browsing

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `127.0.0.1` | Bind address, use `0.0.0.0` for Docker |
| `ADMIN_USERNAME` | `admin` | Admin username |
| `ADMIN_PASSWORD` | `changeme` | Admin password (**must change in production**) |
| `SESSION_SECRET` | `dev-secret` | Session encryption key (**must change in production**) |
| `DB_PATH` | `./data/defuddle.db` | SQLite database path |
| `NODE_ENV` | — | Set to `production` to enable security checks |
| `COOKIE_SECURE` | `false` | Set to `true` for HTTPS |
| `TZ` | `UTC` | Timezone, e.g. `Asia/Shanghai` |

The service refuses to start in production if `ADMIN_PASSWORD` or `SESSION_SECRET` remain at their defaults.

## Project Structure

```
src/
├── index.ts              # Entry, Express config, proxy route
├── db/
│   └── index.ts          # SQLite init, schema, migration
├── middleware/
│   ├── admin-auth.ts     # Admin session auth
│   ├── api-auth.ts       # API Key auth
│   └── csrf.ts           # CSRF protection
├── routes/
│   └── admin.ts          # Admin routes (CRUD + stats)
└── services/
    └── defuddle.ts       # Defuddle parsing service
nix/modules/
├── nixos.nix             # NixOS system module
└── home-manager.nix      # Home Manager user module
views/
├── login.ejs             # Login page
├── dashboard.ejs         # Main panel (Keys + domain ranking)
├── key-stats.ejs         # Key stats detail
├── domain-stats.ejs      # Domain stats detail
└── layout-nav.ejs        # Navbar
```

## Security

- Timing-safe API Key comparison to prevent timing attacks
- CSRF protection on all state-changing requests
- XSS prevention via content-type headers and input sanitization
- Rate limiting (100 req/min per IP)
- HttpOnly + Secure cookies for admin sessions
- Cookie signed with secret key, tamper detection
- Production mode refuses to start with default credentials

## License

[WTFPL](http://www.wtfpl.net/) — Do What The Fuck You Want To Public License
