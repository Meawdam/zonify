import type { Request, Response, NextFunction } from "express";
import { isValidObjectId } from "mongoose";
import { UserModel, publicUser, type Role } from "../modules/users/schema/user.schema.js";
import { SessionModel } from "../modules/users/schema/session.schema.js";
import { cookieToken, verifyToken } from "../modules/users/session.js";
import { HttpError } from "./http-error.js";
export interface AuthRequest extends Request {
  user?: ReturnType<typeof publicUser>;
  sessionId?: string;
  authVersion?: number;
}
export const authMiddleware = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = cookieToken(req);
    const payload = token ? verifyToken(token) : null;
    if (!payload || !isValidObjectId(payload.userId)) throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
    const [session, user] = await Promise.all([
      SessionModel.findOne({ _id: payload.sessionId, userId: payload.userId, expiresAt: { $gt: new Date() } }).lean(),
      UserModel.findById(payload.userId).select("+authVersion").lean(),
    ]);
    if (!session || !user || session.authVersion !== (user.authVersion ?? 0)) throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
    req.user = publicUser(user);
    req.sessionId = session._id;
    req.authVersion = user.authVersion ?? 0;
    next();
  } catch (error) { next(error); }
};
export const requireRole = (...roles: Role[]) => (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role as Role)) return next(new HttpError(403, "FORBIDDEN", "คุณไม่มีสิทธิ์ทำรายการนี้"));
  next();
};
