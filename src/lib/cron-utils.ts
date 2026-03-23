import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export const verifyCronAuth = async (req: Request): Promise<boolean> => {
  const signature = req.headers.get("Upstash-Signature");
  if (!signature) {
    return false;
  }

  const body = await req.text();
  try {
    await receiver.verify({ signature, body, url: req.url });
    return true;
  } catch {
    return false;
  }
};
