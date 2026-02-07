import { Request } from "express";

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const getUserId = (req: Request) => {
  const anyReq = req as any;
  if (anyReq.user && (anyReq.user.id || anyReq.user.sub)) return anyReq.user.id || anyReq.user.sub;
  // dev fallback
  if (process.env.NODE_ENV !== "production") {
    const dev = req.headers["x-dev-user-id"] as string | undefined;
    if (dev) return dev as string;
    if (anyReq.body && anyReq.body.userId) return anyReq.body.userId;
  }
  return undefined;
};
