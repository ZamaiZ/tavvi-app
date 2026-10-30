import { z } from "zod"

const emailSchema = z.string().trim().toLowerCase().email("Informe um email válido.")

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha."),
})

export const adminRegistrationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Informe seu nome com pelo menos 2 caracteres.")
      .max(100, "O nome deve ter no máximo 100 caracteres."),
    email: emailSchema,
    password: z
      .string()
      .min(8, "A senha precisa ter pelo menos 8 caracteres."),
    passwordConfirmation: z.string().min(1, "Confirme sua senha."),
  })
  .superRefine((value, context) => {
    if (value.password !== value.passwordConfirmation) {
      context.addIssue({
        code: "custom",
        path: ["passwordConfirmation"],
        message: "As senhas não conferem.",
      })
    }
  })

export type AdminLoginInput = z.infer<typeof adminLoginSchema>
export type AdminRegistrationInput = z.infer<typeof adminRegistrationSchema>
