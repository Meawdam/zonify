import bcrypt from "bcrypt";
import { isValidObjectId } from "mongoose";
import type { CreateUserDto, LoginUserDto } from "../dto/user.dto.js";
import { UserRepository } from "../repository/user.repository.js";
import { UserModel, publicUser } from "../schema/user.schema.js";
import { SessionModel } from "../schema/session.schema.js";
import { HttpError } from "../../../middlewares/http-error.js";

export class UserService {
  private readonly repository = new UserRepository();
  async getAll() { return (await this.repository.findAll()).map(publicUser); }
  async getById(id: string) {
    if (!isValidObjectId(id)) throw new HttpError(400, "INVALID_ID", "รหัสผู้ใช้ไม่ถูกต้อง");
    const user = await this.repository.findById(id);
    if (!user) throw new HttpError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้");
    return publicUser(user);
  }
  async create(data: CreateUserDto) {
    return publicUser(await this.repository.create({ ...data, password: await bcrypt.hash(data.password, 12) }));
  }
  async login(data: LoginUserDto) {
    const user = await this.repository.findForLogin(data.email);
    if (!user || !await bcrypt.compare(data.password, user.password)) throw new HttpError(401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    return { user: publicUser(user), authVersion: user.authVersion ?? 0 };
  }
  async updateProfile(id: string, data: { name: string; phone: string }) {
    const user = await this.repository.updateProfile(id, data);
    if (!user) throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
    return publicUser(user);
  }
  async changePassword(id: string, authVersion: number, currentPassword: string, password: string) {
    const user = await UserModel.findById(id).select("+password +authVersion");
    if (!user || (user.authVersion ?? 0) !== authVersion) throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
    if (!await bcrypt.compare(currentPassword, user.password)) throw new HttpError(400, "WRONG_PASSWORD", "รหัสผ่านเดิมไม่ถูกต้อง");
    const hash = await bcrypt.hash(password, 12);
    // Optimistic atomic update: concurrent password changes cannot silently overwrite each other.
    const result = await UserModel.updateOne({ _id: id, password: user.password }, { $set: { password: hash }, $inc: { authVersion: 1 } });
    if (result.modifiedCount !== 1) throw new HttpError(409, "ACCOUNT_CHANGED", "ข้อมูลบัญชีเปลี่ยนแล้ว กรุณาเข้าสู่ระบบใหม่");
    // authVersion also invalidates a concurrent login that used the old password.
    await SessionModel.deleteMany({ userId: id });
  }
  async delete(id: string, actorId: string) {
    if (id === actorId) throw new HttpError(403, "SELF_DELETE", "ไม่สามารถลบบัญชีตนเองได้");
    await this.getById(id);
    const user = await this.repository.deleteById(id);
    if (!user) throw new HttpError(404, "USER_NOT_FOUND", "ไม่พบผู้ใช้");
    await SessionModel.deleteMany({ userId: id });
  }
}
