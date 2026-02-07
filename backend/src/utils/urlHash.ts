import { createHash } from "crypto";

export const urlHash = (value: string) => {
  const salt = process.env.URL_HASH_SALT || "";
  return createHash("sha256").update(salt + value).digest("hex");
};
