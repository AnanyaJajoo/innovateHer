import { RealityDefender, type DetectionResult } from "@realitydefender/realitydefender";

const getApiKey = () => {
  const apiKey = process.env.REALITY_DEFENDER_API_KEY;
  if (!apiKey) {
    throw new Error("REALITY_DEFENDER_API_KEY is not set");
  }
  return apiKey;
};

export type RealityDefenderSdkResult = DetectionResult & {
  metadata?: {
    reasons?: Array<{ code?: string; message?: string }>;
  };
  error?: { code?: string; message?: string };
  message?: string;
};

const createClient = () =>
  new RealityDefender({
    apiKey: getApiKey()
  });

export const uploadForDetection = async (filePath: string) => {
  console.log("[RealityDefender] API: 1 call per image (upload + poll)", { filePath });
  const client = createClient();
  const { requestId } = await client.upload({ filePath });
  return { client, requestId };
};

export const pollForResult = async (
  client: RealityDefender,
  requestId: string,
  options: { pollingInterval: number; timeoutMs: number }
) =>
  new Promise<RealityDefenderSdkResult | null>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      client.off("result", onResult);
      client.off("error", onError);
    };

    const onResult = (result: RealityDefenderSdkResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    client.on("result", onResult);
    client.on("error", onError);

    client.pollForResults(requestId, {
      pollingInterval: options.pollingInterval,
      timeout: options.timeoutMs
    });

    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, options.timeoutMs + 1000);
  });
