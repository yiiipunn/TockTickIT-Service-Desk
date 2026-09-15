import { randomBytes } from "node:crypto";
import argon2 from "argon2";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    ...ARGON2_OPTIONS,
    salt: randomBytes(16),
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) {
  const fields: Record<string, string> = {};

  if (!currentPassword || currentPassword.length > PASSWORD_MAX_LENGTH) {
    fields.currentPassword = "Enter your current password.";
  }

  if (!newPassword) {
    fields.newPassword = "Enter a new password.";
  } else if (
    newPassword.length < PASSWORD_MIN_LENGTH ||
    newPassword.length > PASSWORD_MAX_LENGTH
  ) {
    fields.newPassword = "Password must contain 12 to 128 characters.";
  } else if (/^\s+$/.test(newPassword)) {
    fields.newPassword = "Password cannot contain only whitespace.";
  } else if (currentPassword && newPassword === currentPassword) {
    fields.newPassword = "New password must differ from your current password.";
  }

  if (!confirmPassword) {
    fields.confirmPassword = "Confirm your new password.";
  } else if (confirmPassword !== newPassword) {
    fields.confirmPassword = "Passwords do not match.";
  }

  return fields;
}
