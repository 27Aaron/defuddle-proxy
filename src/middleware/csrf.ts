import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

export function generateCsrfToken(req: Request): string {
  const token = crypto.randomBytes(32).toString("hex");
  req.session!.csrfToken = token;
  return token;
}

export function getCsrfToken(req: Request): string | undefined {
  return req.session?.csrfToken;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const sessionToken = req.session?.csrfToken;
  if (!sessionToken) {
    res.status(403).send("Missing CSRF token");
    return;
  }

  const token = req.body?._csrf || req.headers["x-csrf-token"];
  if (!token || token !== sessionToken) {
    res.status(403).send("Invalid CSRF token");
    return;
  }
  next();
}
