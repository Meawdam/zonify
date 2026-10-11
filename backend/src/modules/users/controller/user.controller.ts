import type { Request, Response } from "express";
import type { AuthRequest } from "../../../middlewares/auth.middleware.js";
import { HttpError } from "../../../middlewares/http-error.js";
import { UserService } from "../service/user.service.js";
import { createUserDto, loginUserDto, profileDto, changePasswordDto } from "../dto/user.dto.js";
import { issueSession, cookieToken, verifyToken, clearSessionCookie } from "../session.js";
import { SessionModel } from "../schema/session.schema.js";
const idParam = (req: Request) => {
  const id = req.params.id;
  if (typeof id !== "string") throw new HttpError(400, "INVALID_ID", "รหัสผู้ใช้ไม่ถูกต้อง");
  return id;
};
export class UserController {
  private readonly service = new UserService();
  getAll = async (_req: Request, res: Response) => { res.json(await this.service.getAll()); };
  getById = async (req: Request, res: Response) => { res.json(await this.service.getById(idParam(req))); };
  getMe = async (req: AuthRequest, res: Response) => { res.json(req.user); };
  create = async (req: Request, res: Response) => { res.status(201).json(await this.service.create(createUserDto.parse(req.body))); };
  login = async (req: Request, res: Response) => {
    const result = await this.service.login(loginUserDto.parse(req.body));
    const previous = cookieToken(req);
    const payload = previous ? verifyToken(previous) : null;
    if (payload) await SessionModel.deleteOne({ _id: payload.sessionId, userId: payload.userId });
    await issueSession(res, result.user.id, result.authVersion);
    res.json(result.user);
  };
  logout = async (req: Request, res: Response) => {
    const token = cookieToken(req);
    const payload = token ? verifyToken(token) : null;
    if (payload) await SessionModel.deleteOne({ _id: payload.sessionId, userId: payload.userId });
    clearSessionCookie(res);
    res.status(204).end();
  };
  updateProfile = async (req: AuthRequest, res: Response) => {
    res.json(await this.service.updateProfile(req.user!.id, profileDto.parse(req.body)));
  };
  changePassword = async (req: AuthRequest, res: Response) => {
    const data = changePasswordDto.parse(req.body);
    await this.service.changePassword(req.user!.id, req.authVersion!, data.currentPassword, data.password);
    clearSessionCookie(res);
    res.status(204).end();
  };
  delete = async (req: AuthRequest, res: Response) => {
    await this.service.delete(idParam(req), req.user!.id);
    res.status(204).end();
  };
}
