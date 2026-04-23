"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

interface ManageVisibilityPopoverProps {
  grantId: string;
  granteeName: string;
}

export function ManageVisibilityPopover({ grantId, granteeName }: ManageVisibilityPopoverProps) {
  const t = useTranslations("SharedAccessSettings");
  const trpcUtils = trpc.useUtils();

  const { data: categories, isPending: isLoadingCategories } = trpc.category.getAll.useQuery();
  const {
    data: excludedCategoryIds,
    isPending: isLoadingExclusions,
    isError: isExclusionsError,
  } = trpc.sharedAccess.getExclusionsForGrant.useQuery({ grantId });

  const { mutate: toggleExclusion, isPending: isToggling } = trpc.sharedAccess.toggleExclusion.useMutation({
    onMutate: async ({ categoryId }) => {
      await trpcUtils.sharedAccess.getExclusionsForGrant.cancel({ grantId });
      const previous = trpcUtils.sharedAccess.getExclusionsForGrant.getData({ grantId });
      trpcUtils.sharedAccess.getExclusionsForGrant.setData({ grantId }, (old) => {
        if (!old) return old;
        return old.includes(categoryId) ? old.filter((id) => id !== categoryId) : [...old, categoryId];
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        trpcUtils.sharedAccess.getExclusionsForGrant.setData({ grantId }, context.previous);
      }
      toast.error(t("toggleExclusionError"));
    },
    onSettled: () => {
      trpcUtils.sharedAccess.getExclusionsForGrant.invalidate({ grantId });
    },
  });

  const isLoading = isLoadingCategories || isLoadingExclusions;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {t("manageVisibilityButton")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-y-3">
          <div>
            <p className="text-sm font-medium">{t("manageVisibilityTitle")}</p>
            <p className="text-muted-foreground text-xs">{t("manageVisibilityDescription", { name: granteeName })}</p>
          </div>
          {isLoading ? (
            <Spinner />
          ) : isExclusionsError ? (
            <p className="text-destructive text-sm">{t("loadExclusionsError")}</p>
          ) : !categories || categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noCategories")}</p>
          ) : (
            <div className="flex flex-col gap-y-2">
              {categories.map((category) => {
                const isExcluded = excludedCategoryIds?.includes(category.id) ?? false;
                return (
                  <div key={category.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <Switch
                      checked={!isExcluded}
                      onCheckedChange={() => toggleExclusion({ grantId, categoryId: category.id })}
                      disabled={isToggling}
                      aria-label={category.name}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
