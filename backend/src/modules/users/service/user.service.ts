import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import type { CreateUserDto, LoginUserDto } from "../dto/user.dto.js";
import { userRepository } from "../repository/user.repository.js";

export class UserService {
  private readonly userRepository: userRepository;

  constructor() {
    this.userRepository = new userRepository();
  }

  async getAll() {
    return this.userRepository.findAll();
  }

  async getById(id: string) {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw Error("User not found");
    }

    return user;
  }

  async create(data: CreateUserDto) {
    const existingUser = await this.userRepository.findByEmail(data.email);

    if (existingUser) {
      throw new Error("Email already exits");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    return this.userRepository.create({
      ...data,
      password: hashedPassword,
    });
  }

  async delete(id: string) {
    const user = await this.userRepository.deleteById(id);

    if (!user) {
      throw Error("User not found");
    }

    return user;
  }

  async login(data: LoginUserDto) {
    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      throw new Error("Invalid email or password");
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if(!passwordMatch) {
        throw new Error("Invalid email or password");
    }

    const jwtSecret = process.env.JWT_SECRET;

    if(!jwtSecret) {
        throw new Error("JWT_SECRET is not defined");
    }

    const token = jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email
        },
        jwtSecret,
        {
            expiresIn: "1h"
        }
    );

    return {
        token,
    };
  }
}
