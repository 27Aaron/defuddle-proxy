import { Router, Request, Response } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import db from "../db/index.js";
import { adminAuth } from "../middleware/admin-auth.js";
import { generateCsrfToken, getCsrfToken, csrfProtection } from "../middleware/csrf.js";

const router = Router();

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

if (process.env.NODE_ENV === "production" && ADMIN_PASSWORD === "changeme") {
  console.error("FATAL: ADMIN_PASSWORD must be changed from default in production");
  process.exit(1);
}

const DOMAIN_EXTRACT_SQL = `CASE
  WHEN INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') > 0
  THEN SUBSTR(SUBSTR(url, INSTR(url, '://') + 3), 1, INSTR(SUBSTR(url, INSTR(url, '://') + 3), '/') - 1)
  ELSE SUBSTR(url, INSTR(url, '://') + 3)
END`;

function escapeLike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function domainLikePatterns(domain: string): [string, string] {
  const safe = escapeLike(domain);
  return [`%://${safe}/%`, `%://${safe}`];
}

// --- Login ---

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts, please try again later",
});

router.get("/login", (req: Request, res: Response) => {
  if (req.session?.user) {
    res.redirect("/admin/");
    return;
  }
  const csrfToken = generateCsrfToken(req);
  res.render("login", { error: null, csrfToken });
});

router.post("/login", loginLimiter, csrfProtection, (req: Request, res: Response) => {
  const { username, password } = req.body;
  const userMatch = username === ADMIN_USERNAME;
  const pwBuf = Buffer.from(String(password));
  const adminPwBuf = Buffer.from(ADMIN_PASSWORD);
  const pwMatch = pwBuf.length === adminPwBuf.length && crypto.timingSafeEqual(pwBuf, adminPwBuf);
  if (userMatch && pwMatch) {
    req.session!.user = username;
    // Regenerate CSRF token after login to prevent fixation
    generateCsrfToken(req);
    res.redirect("/admin/");
    return;
  }
  res.render("login", { error: "用户名或密码错误", csrfToken: getCsrfToken(req)! });
});

router.post("/logout", csrfProtection, (req: Request, res: Response) => {
  req.session?.destroy(() => {
    res.redirect("/admin/login");
  });
});

// --- Dashboard ---

const PER_PAGE = 10;

router.get("/", adminAuth, (req: Request, res: Response) => {
  const tab = req.query.tab === "domains" ? "domains" : "keys";
  const keyPage = Math.max(1, Number(req.query.key_page) || 1);
  const domainPage = Math.max(1, Number(req.query.domain_page) || 1);
  const csrfToken = getCsrfToken(req) || generateCsrfToken(req);

  // Stats
  const totalUsage = db.prepare("SELECT COUNT(*) as count FROM usage_logs").get() as { count: number };
  const totalSuccess = db.prepare("SELECT COUNT(*) as count FROM usage_logs WHERE status_code < 400").get() as { count: number };
  const successRate = totalUsage.count > 0 ? Math.round(totalSuccess.count * 100 / totalUsage.count) : 0;

  // Keys pagination
  const keyTotal = db.prepare("SELECT COUNT(*) as count FROM api_keys").get() as { count: number };
  const keys = db
    .prepare(
      `SELECT ak.id, ak.key, ak.name, ak.created_at,
              COUNT(ul.id) as usage_count,
              MAX(ul.created_at) as last_used
       FROM api_keys ak
       LEFT JOIN usage_logs ul ON ul.key_id = ak.id
       GROUP BY ak.id
       ORDER BY ak.created_at ASC
       LIMIT ? OFFSET ?`,
    )
    .all(PER_PAGE, (keyPage - 1) * PER_PAGE);
  const keyPages = Math.ceil(keyTotal.count / PER_PAGE);

  // Domain stats pagination
  const domainTotal = db
    .prepare(
      `SELECT COUNT(DISTINCT ${DOMAIN_EXTRACT_SQL}) as count FROM usage_logs WHERE url IS NOT NULL AND url LIKE 'http%'`,
    )
    .get() as { count: number };
  const domainStats = db
    .prepare(
      `SELECT
         ${DOMAIN_EXTRACT_SQL} as domain,
         COUNT(*) as count,
         ROUND(SUM(CASE WHEN status_code < 400 THEN 1.0 ELSE 0 END) * 100 / COUNT(*)) as success_rate,
         GROUP_CONCAT(DISTINCT COALESCE(ak.name, '未命名')) as key_names,
         MAX(ul.created_at) as last_accessed
       FROM usage_logs ul
       LEFT JOIN api_keys ak ON ul.key_id = ak.id
       WHERE ul.url IS NOT NULL AND ul.url LIKE 'http%'
       GROUP BY domain
       ORDER BY count DESC
       LIMIT ? OFFSET ?`,
    )
    .all(PER_PAGE, (domainPage - 1) * PER_PAGE) as { domain: string; count: number; success_rate: number; key_names: string; last_accessed: string }[];
  const domainPages = Math.ceil(domainTotal.count / PER_PAGE);

  res.render("dashboard", {
    tab, keys, keyPage, keyPages,
    domainStats, domainPage, domainPages,
    totalUsage: totalUsage.count, successRate,
    csrfToken,
  });
});

// --- Key CRUD ---

router.post("/keys", adminAuth, csrfProtection, (req: Request, res: Response) => {
  const { name } = req.body;
  const key = "sk-" + crypto.randomBytes(24).toString("hex");
  db.prepare("INSERT INTO api_keys (key, name) VALUES (?, ?)").run(key, name || null);
  res.redirect("/admin/?tab=keys");
});

router.post("/keys/:id/rename", adminAuth, csrfProtection, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  db.prepare("UPDATE api_keys SET name = ? WHERE id = ?").run(name || null, Number(id));
  res.redirect("/admin/?tab=keys");
});

router.post("/keys/:id/delete", adminAuth, csrfProtection, (req: Request, res: Response) => {
  const { id } = req.params;
  db.transaction(() => {
    db.prepare("DELETE FROM usage_logs WHERE key_id = ?").run(Number(id));
    db.prepare("DELETE FROM api_keys WHERE id = ?").run(Number(id));
  })();
  res.redirect("/admin/?tab=keys");
});

// --- Key Stats ---

router.get("/keys/:id/stats", adminAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const tab = req.query.tab === "daily" ? "daily" : "logs";
  const logsPage = Math.max(1, Number(req.query.logs_page) || 1);
  const dailyPage = Math.max(1, Number(req.query.daily_page) || 1);
  const csrfToken = getCsrfToken(req) || generateCsrfToken(req);

  const keyInfo = db.prepare("SELECT * FROM api_keys WHERE id = ?").get(Number(id)) as any;
  if (!keyInfo) {
    res.redirect("/admin/");
    return;
  }

  const totalCount = db
    .prepare("SELECT COUNT(*) as count FROM usage_logs WHERE key_id = ?")
    .get(Number(id)) as { count: number };

  // Recent logs pagination
  const recentLogs = db
    .prepare(
      `SELECT url, status_code, created_at
       FROM usage_logs
       WHERE key_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(Number(id), PER_PAGE, (logsPage - 1) * PER_PAGE) as { url: string; status_code: number; created_at: string }[];
  const logsPages = Math.ceil(totalCount.count / PER_PAGE);

  // Daily stats pagination
  const dailyTotal = db
    .prepare(
      `SELECT COUNT(DISTINCT DATE(created_at)) as count FROM usage_logs WHERE key_id = ?`,
    )
    .get(Number(id)) as { count: number };
  const dailyStats = db
    .prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM usage_logs
       WHERE key_id = ?
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
    )
    .all(Number(id), PER_PAGE, (dailyPage - 1) * PER_PAGE) as { date: string; count: number }[];
  const dailyPages = Math.ceil(dailyTotal.count / PER_PAGE);

  // Mask the key for display
  const maskedKey = keyInfo.key.length > 11
    ? keyInfo.key.slice(0, 7) + "···" + keyInfo.key.slice(-4)
    : keyInfo.key;

  res.render("key-stats", {
    keyInfo: { ...keyInfo, key: keyInfo.key, maskedKey },
    totalCount: totalCount.count,
    tab, recentLogs, logsPage, logsPages,
    dailyStats, dailyPage, dailyPages,
    csrfToken,
  });
});

// --- Domain Stats ---

router.get("/domains/:domain/stats", adminAuth, (req: Request, res: Response) => {
  const domain = String(req.params.domain);
  const page = Math.max(1, Number(req.query.page) || 1);

  const [likePattern, likePattern2] = domainLikePatterns(domain);

  const total = db
    .prepare(
      `SELECT COUNT(*) as count FROM usage_logs WHERE url LIKE ? OR url LIKE ?`,
    )
    .get(likePattern, likePattern2) as { count: number };

  const logs = db
    .prepare(
      `SELECT ul.url, ul.status_code, ul.created_at, COALESCE(ak.name, '未命名') as key_name
       FROM usage_logs ul
       LEFT JOIN api_keys ak ON ul.key_id = ak.id
       WHERE ul.url LIKE ? OR ul.url LIKE ?
       ORDER BY ul.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(likePattern, likePattern2, PER_PAGE, (page - 1) * PER_PAGE) as {
    url: string; status_code: number; created_at: string; key_name: string;
  }[];

  const pages = Math.ceil(total.count / PER_PAGE);
  const csrfToken = getCsrfToken(req) || generateCsrfToken(req);
  res.render("domain-stats", { domain, logs, page, pages, totalCount: total.count, csrfToken });
});

export default router;
