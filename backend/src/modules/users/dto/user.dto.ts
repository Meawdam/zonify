import { z } from "zod";

export const createUserDto = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6)
})

export const loginUserDto = z.object({
    email: z.string().email(),
    password: z.string().min(1)
})

export type CreateUserDto = z.infer<typeof createUserDto>
export type LoginUserDto = z.infer<typeof loginUserDto>