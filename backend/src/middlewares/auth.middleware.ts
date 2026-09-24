import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthRequest extends Request {
    user?: {
        userId: string,
        email: string
    };
}

export const authMiddleware = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if(!authHeader) {
            return res.status(401).json({
                message: "Authorization head is required"
            });
        }

        const [type, token] = authHeader.split(" ");

        if(type !== "Bearer" || !token) {
            return res.status(401).json({
                message: "invalid authorization format"
            });
        }

        const decoded = jwt.verify(token, env.JWT_SECRET);

        if(
            typeof decoded !== "object" ||
            decoded === null ||
            typeof decoded.userId !== "string" ||
            typeof decoded.email !== "string"
        ) {
            return res.status(401).json({
                message: "Invalid token payload"
            });
        }

        req.user = {
            userId  : decoded.userId,
            email: decoded.email
        };

        next();
    } catch {
        return res.status(401).json({
            message: "invalid or expired token"
        })
    }
}