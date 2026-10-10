import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(72, "A senha pode ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa ter letras.")
  .regex(/\d/, "A senha precisa ter números.");

export const fullNameSchema = z.string().trim().min(2, "Informe seu nome.").max(120);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

export const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  companyName: z.string().trim().max(120).optional(),
  invitationToken: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  captchaToken: z.string().optional(),
});

export const signUpCompanySchema = signUpSchema.extend({
  companyName: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().optional(),
});

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

export const companyNameSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa.").max(120),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
