"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/trpc/client";
import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export const CopyShareLinkButton = ({ categoryId }: { categoryId: string }) => {
  const t = useTranslations("TaskList");
  const { data: audience, isPending, isError } = trpc.sharedAccess.getCategoryAudience.useQuery({ categoryId });

  const grantees = audience?.grantees ?? [];
  const isShared = grantees.length > 0;
  const granteeNames = grantees.map((g) => g.name ?? g.email).join(", ");

  const handleCopy = async () => {
    if (!audience) return;

    const url = new URL(`/shared/${audience.ownerId}`, window.location.origin);
    url.searchParams.set("category", categoryId);
    url.searchParams.set("view", "kanban");

    try {
      await navigator.clipboard.writeText(url.toString());
      toast.success(t("shareLinkCopied"));
    } catch {
      toast.error(t("shareLinkCopyFailed"));
    }
  };

  const tooltip = isError
    ? t("shareLinkUnavailable")
    : isShared
      ? t("sharedWith", { names: granteeNames })
      : t("notShared");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons swallow pointer events, so the span keeps the tooltip working. */}
        <span tabIndex={isShared ? -1 : 0}>
          <Button variant="outline" onClick={handleCopy} disabled={isPending || isError || !isShared}>
            <LinkIcon />
            {t("copyShareLink")}
          </Button>
        </span>
      </TooltipTrigger>
      {!isPending && <TooltipContent>{tooltip}</TooltipContent>}
    </Tooltip>
  );
};
