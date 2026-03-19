import { prisma } from "@/lib/prisma";
import type { UserJSON } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    if (evt.type === "user.created") {
      const { id, first_name, last_name, email_addresses } = evt.data as UserJSON;
      const email = email_addresses[0]?.email_address;

      if (!email) {
        return new Response("Invalid webhook payload: missing email", { status: 400 });
      }

      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      try {
        await prisma.user.upsert({
          where: { clerkId: id },
          update: {},
          create: { clerkId: id, name, email, userSettings: { create: {} } },
        });
      } catch (err) {
        console.error(err);
        return new Response("Failed to create user", { status: 500 });
      }
    }

    return new Response("Webhook received", { status: 200 });
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error verifying webhook", { status: 400 });
  }
}
