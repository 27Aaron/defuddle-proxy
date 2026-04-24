import { Request, Response, NextFunction } from "express";
import db from "../db/index.js";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  let key = "";

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    key = authHeader.slice(7).trim();
  } else if (req.query.key) {
    key = req.query.key as string;
  }

  if (!key) {
    res.status(401).json({ error: "Missing API key. Use Authorization: Bearer <key> or ?key=<key>" });
    return;
  }

  const row = db.prepare("SELECT id, is_active FROM api_keys WHERE key = ?").get(key) as
    | { id: number; is_active: number }
    | undefined;

  if (!row) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }

  if (!row.is_active) {
    res.status(403).json({ error: "API key is disabled" });
    return;
  }

  (req as any).apiKeyId = row.id;
  next();
}
