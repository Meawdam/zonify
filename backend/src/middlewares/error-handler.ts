import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.issues,
    });
  }

  if (error instanceof Error) {
    if (error.message === "User not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (error.message === "Email already exists") {
      return res.status(409).json({
        message: error.message,
      });
    }
  }

  if (error instanceof Error) {
    if (error.message === "Invalid email or password") {
      return res.status(401).json({
        message: error.message,
      });
    }

    if (error.message === "User not found") {
      return res.status(404).json({
        message: error.message,
      });
    }

    if (error.message === "Email already exists") {
      return res.status(409).json({
        message: error.message,
      });
    }
  }

  console.error(error);

  return res.status(500).json({
    message: "Internal server error",
  });
};
