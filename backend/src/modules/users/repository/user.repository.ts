import { UserModel } from "../schema/user.schema.js"
import type { CreateUserDto } from "../dto/user.dto.js"

export class userRepository {
    async findAll() {
        return UserModel.find().select("-password").lean();
    }


  async findById(id: string) {
    return UserModel.findById(id).select("-password").lean();
  }

  async findByEmail(email: string) {
    return UserModel.findOne({ email });
  }

  async create(data: CreateUserDto) {
    const user = await UserModel.create(data);

    return {
      id: user._id,
      name: user.name,
      email: user.email,
    };
  }

  async deleteById(id: string) {
    return UserModel.findByIdAndDelete(id);
  }
}