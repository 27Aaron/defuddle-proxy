import "dotenv/config";

// Set timezone before anything else — affects all Date.toLocaleString calls
if (process.env.TZ) {
  process.env.TZ = process.env.TZ;
} else {
  process.env.TZ = "UTC";
}

import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";
import adminRouter from "./routes/admin.js";
import { apiKeyAuth } from "./middleware/api-auth.js";
import { fetchAndParse } from "./services/defuddle.js";
import db from "./db/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "dev-secret")) {
  console.error("FATAL: SESSION_SECRET must be set and changed from default in production");
  process.exit(1);
}

app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
    },
  }),
);

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "../views"));

app.use("/admin", adminRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/", (_req, res) => {
  const host = _req.headers.host || `localhost:${PORT}`;
  const proto = _req.headers["x-forwarded-proto"] || (process.env.NODE_ENV === "production" ? "https" : "http");
  const baseUrl = `${proto}://${host}`;
  res.render("index", { baseUrl });
});

// Official Defuddle API style: GET /{url}?key=... or with Bearer header
app.get("/{*url}", apiKeyAuth, async (req, res) => {
  // Express 5 {*} returns string | string[], join if array
  const segments = req.params.url;
  const raw = Array.isArray(segments) ? segments.join("/") : String(segments);
  if (!raw || raw === "/") {
    res.status(400).json({ error: "Missing URL in path. Usage: /{url}" });
    return;
  }

  // Express collapses // to /, so https:/host becomes https:/host — fix double slash
  let url = raw.replace(/^(https?):\/([^/])/, "$1://$2");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  const apiKeyId = (req as any).apiKeyId as number;

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  try {
    const result = await fetchAndParse(url);
    res.type("text/plain").send(formatMarkdown(url, result));
    db.prepare("INSERT INTO usage_logs (key_id, url, status_code) VALUES (?, ?, ?)").run(
      apiKeyId, url, 200,
    );
  } catch (err: any) {
    console.error("Parse error for", url, err.message);
    db.prepare("INSERT INTO usage_logs (key_id, url, status_code) VALUES (?, ?, ?)").run(
      apiKeyId, url, 502,
    );
    res.status(502).json({ error: "Failed to parse page" });
  }
});

app.listen(Number(PORT), HOST, () => {
  console.log(`Defuddle Proxy running on http://${HOST}:${PORT}`);
});

function formatMarkdown(source: string, r: any): string {
  const frontmatter: string[] = [
    `title: ${JSON.stringify(r.title)}`,
    `author: ${JSON.stringify(r.author)}`,
    `site: ${JSON.stringify(r.site)}`,
    `source: ${JSON.stringify(source)}`,
    `domain: ${JSON.stringify(r.domain)}`,
    `description: ${JSON.stringify(r.description)}`,
    `word_count: ${r.wordCount}`,
  ];
  if (r.published) frontmatter.push(`published: ${JSON.stringify(r.published)}`);
  if (r.image) frontmatter.push(`image: ${JSON.stringify(r.image)}`);
  if (r.language) frontmatter.push(`language: ${JSON.stringify(r.language)}`);

  return `---\n${frontmatter.join("\n")}\n---\n\n${r.content}\n`;
}
