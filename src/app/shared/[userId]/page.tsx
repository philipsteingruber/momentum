"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { SharedTaskList } from "@/_components/task-view/shared-task-list";
import { Spinner } from "@/components/ui/spinner";
import { GrantStatus } from "@/generated/prisma/enums";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";
import { use, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const Page = ({ params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = use(params);
  const router = useRouter();
  const t = useTranslations("SharedView");

  const { data: grants, isPending } = trpc.sharedAccess.getGrantsReceived.useQuery();
  const grantor = grants?.find((g) => g.grantor.id === userId && g.status === GrantStatus.ACCEPTED);

  useEffect(() => {
    if (!isPending && grants !== undefined && !grantor) {
      toast.error(t("noAccess"));
      router.push("/");
    }
  }, [isPending, grants, grantor, router, t]);

  if (isPending || !grantor) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <MaxWidthWrapper>
      <SharedTaskList grantorId={userId} />
    </MaxWidthWrapper>
  );
};

export default Page;
