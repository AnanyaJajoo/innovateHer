export const normalizeUrl = (input: string) => {
  const url = new URL(input);
  const normalizedUrl = `${url.protocol}//${url.host}${url.pathname}`;

  return {
    url,
    normalizedUrl,
    domain: url.hostname
  };
};
