import { Request, Response, NextFunction } from "express";
import { UserService } from "../service/user.service.js";
import { createUserDto, loginUserDto } from "../dto/user.dto.js";

export class UserController {
  private readonly userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAll = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.userService.getAll();

      return res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id || Array.isArray(id)) {
        return res.status(400).json({
          message: "Invalid user id",
        });
      }

      const user = await this.userService.getById(id);

      return res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createUserDto.parse(req.body);

      const user = await this.userService.create(data);

      return res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id || Array.isArray(id)) {
        return res.status(400).json({
          message: "Invalid user id",
        });
      }

      await this.userService.delete(id);

      return res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = loginUserDto.parse(req.body);

        const result = await this.userService.login(data);

        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
  }
}
