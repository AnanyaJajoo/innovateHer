import { createHash } from "crypto";

export const hashUrl = (value: string) => {
  const salt = process.env.URL_HASH_SALT ?? "";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
};

export const hashWithSalt = (value: string, salt: string) =>
  createHash("sha256").update(`${salt}:${value}`).digest("hex");

export const hashBufferWithSalt = (value: Buffer, salt: string) =>
  createHash("sha256").update(salt).update(value).digest("hex");
