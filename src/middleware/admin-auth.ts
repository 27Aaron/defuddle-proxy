import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    user?: string;
  }
}

export function adminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    res.redirect("/admin/login");
    return;
  }
  next();
}
