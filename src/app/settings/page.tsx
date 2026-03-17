"use client";

import { LoadingCard } from "@/_components/cards/loading-card";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/trpc/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const router = useRouter();

  const trpcUtils = trpc.useUtils();
  const { data: settings, isPending: isLoadingSettings } = trpc.userSettings.get.useQuery();
  const { mutate: updateSettings, isPending: isUpdatingSettings } = trpc.userSettings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved.");
      trpcUtils.userSettings.get.invalidate();
      router.push("/");
    },
  });

  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTimezone(settings?.timezone ?? null);
  }, [settings?.timezone]);

  if (isLoadingSettings) {
    return (
      <MaxWidthWrapper>
        <LoadingCard title="User Settings" className="w-full" />
      </MaxWidthWrapper>
    );
  }

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>User Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-4">
          <Field>
            <FieldLabel>Timezone</FieldLabel>
            <Combobox
              items={Intl.supportedValuesOf("timeZone")}
              disabled={isLoadingSettings}
              value={selectedTimezone}
              onValueChange={(val) => setSelectedTimezone(val)}
            >
              <ComboboxInput placeholder="Select a timezone" />
              <ComboboxContent>
                <ComboboxEmpty>No timezones found</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <div className="flex items-center justify-center">
            <Button
              disabled={isLoadingSettings || !selectedTimezone || isUpdatingSettings}
              onClick={() => updateSettings({ timezone: selectedTimezone! })}
              className="w-1/4"
            >
              {isUpdatingSettings ? <Spinner /> : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
