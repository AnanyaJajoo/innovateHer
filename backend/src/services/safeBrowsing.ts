export const checkSafeBrowsing = async (url: string) => {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!apiKey) {
    return { flagged: false, skipped: true };
  }

  const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: {
          clientId: "innovateher-fraud-checker",
          clientVersion: "0.1.0"
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION"
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }]
        }
      })
    });

    if (!response.ok) {
      return { flagged: false, skipped: true };
    }

    const data = (await response.json()) as { matches?: unknown[] };
    return { flagged: Array.isArray(data.matches) && data.matches.length > 0 };
  } catch {
    return { flagged: false, skipped: true };
  }
};
