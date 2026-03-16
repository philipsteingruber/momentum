import type { DailyDigestEmailProps } from "@/_components/emails/daily-digest";
import { DailyDigestEmail } from "@/_components/emails/daily-digest";
import type { ErrorResponse } from "resend";
import { Resend } from "resend";
import z from "zod";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendDailyDigest = async ({
  to,
  payload,
}: {
  to: string;
  payload: DailyDigestEmailProps;
}): Promise<{ success: boolean; id?: string; error: ErrorResponse | Error | null }> => {
  if (!z.safeParse(z.email(), to).success) {
    return { success: false, error: new Error("Incorrectly formatted recipient address") };
  }

  const { data, error } = await resend.emails.send({
    from: "Momentum <onboarding@resend.dev>",
    to,
    subject: "Daily Digest from Momentum",
    react: DailyDigestEmail(payload),
  });

  return { success: !!data?.id, id: data?.id, error };
};
