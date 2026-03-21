import { openDmChannel } from "@/lib/discord";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?error=missing_code`);
  }

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?error=token_exchange`);
  }

  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userResponse.ok) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?error=user_fetch`);
  }

  const discordUser = (await userResponse.json()) as { id: string; username: string };

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?error=not_authenticated`);
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?error=user_not_found`);
  }

  let discordDmChannelId: string;
  try {
    discordDmChannelId = await openDmChannel(discordUser.id);
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?error=dm_channel`);
  }

  await prisma.userSettings.update({
    where: { userId: user.id },
    data: {
      discordId: discordUser.id,
      discordDmChannelId,
    },
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/discord?connected=true`);
};
