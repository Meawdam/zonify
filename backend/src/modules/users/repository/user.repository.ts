import { UserModel } from "../schema/user.schema.js";
import type { CreateUserDto } from "../dto/user.dto.js";
export class UserRepository {
  findAll() { return UserModel.find().lean(); }
  findById(id: string) { return UserModel.findById(id).lean(); }
  findForLogin(email: string) { return UserModel.findOne({ email }).select("+password +authVersion"); }
  create(data: CreateUserDto) { return UserModel.create({ ...data, role: "customer" }); }
  updateProfile(id: string, data: { name: string; phone: string }) {
    return UserModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true }).lean();
  }
  deleteById(id: string) { return UserModel.findByIdAndDelete(id); }
}
