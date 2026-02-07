export const normalizeDomain = (input: string) => {
  if (!input || typeof input !== "string") throw new Error("invalid domain");
  let v = input.trim().toLowerCase();
  if (v.startsWith("http://") || v.startsWith("https://")) {
    try {
      v = new URL(v).hostname;
    } catch {
      // leave as-is
    }
  }
  if (v.startsWith("www.")) v = v.slice(4);
  return v;
};
