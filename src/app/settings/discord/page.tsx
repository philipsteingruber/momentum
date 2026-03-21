"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/trpc/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpcUtils = trpc.useUtils();

  const { data: status, isPending: isLoadingStatus } = trpc.discord.getStatus.useQuery();
  const { mutate: unlink, isPending: isUnlinking } = trpc.discord.unlink.useMutation({
    onSuccess: () => {
      toast.success("Discord account unlinked.");
      trpcUtils.discord.getStatus.invalidate();
    },
  });

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast.success("Discord account connected successfully");
      router.replace("/settings/discord");
    }
    if (searchParams.get("error")) {
      toast.error("Failed to connect Discord account. Please try again.");
      router.replace("/settings/discord");
    }
  }, [searchParams, router]);

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Discord Integration</CardTitle>
          <CardDescription>
            Connect your Discord account to receive your daily digest as a DM and interact with tasks via slash
            commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[100px]">
          {isLoadingStatus ? (
            <div className="flex h-full justify-center">
              <Spinner />
            </div>
          ) : status?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <div className="size-2 rounded-full bg-green-500" />
                <span className="text-sm">Discord account connected</span>
              </div>
              <Button variant={"outline"} size={"sm"} onClick={() => unlink()} disabled={isUnlinking}>
                {isUnlinking ? <Spinner /> : "Unlink"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-y-3">
              <p className="text-muted-foreground text-sm">
                No Discord account linked. Connect your account to get started.
              </p>
              <Link href={"/api/discord/auth"}>
                <Button>Connect Discord</Button>
              </Link>
              <div className="text-muted-foreground mt-4 rounded-md border p-4 text-sm">
                <p className="mb-1 font-medium">Available slash commands after linking:</p>
                <ul className="list-inside list-disc gap-y-1">
                  <li>
                    <code>/list</code> - List all active tasks
                  </li>
                  <li>
                    <code>/list status:pending</code> - Filter by status
                  </li>
                  <li>
                    <code>/complete task_id:&lt;id&gt;</code> - Mark a task as completed
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
