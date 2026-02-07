import { createHash } from "crypto";

export const hashUrl = (value: string) =>
  createHash("sha256").update(value).digest("hex");
