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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const t = useTranslations("Settings");

  const trpcUtils = trpc.useUtils();
  const { data: settings, isPending: isLoadingSettings } = trpc.userSettings.get.useQuery();
  const { mutate: updateSettings, isPending: isUpdatingSettings } = trpc.userSettings.update.useMutation({
    onSuccess: (_, variables) => {
      document.cookie = `NEXT_LOCALE=${variables.locale}; path=/; max-age=31536000; SameSite=Lax`;
      toast.success(t("savedToast"));
      trpcUtils.userSettings.get.invalidate();
      window.location.href = "/";
    },
  });

  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTimezone(settings?.timezone ?? null);
    setSelectedLocale(settings?.locale ?? null);
  }, [settings?.timezone, settings?.locale]);

  if (isLoadingSettings) {
    return (
      <MaxWidthWrapper>
        <LoadingCard title={t("title")} className="w-full" />
      </MaxWidthWrapper>
    );
  }

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-4">
          <Field>
            <FieldLabel>{t("timezone")}</FieldLabel>
            <Combobox
              items={Intl.supportedValuesOf("timeZone")}
              disabled={isLoadingSettings}
              value={selectedTimezone}
              onValueChange={(val) => setSelectedTimezone(val)}
            >
              <ComboboxInput placeholder={t("timezonePlaceholder")} />
              <ComboboxContent>
                <ComboboxEmpty>{t("timezoneEmpty")}</ComboboxEmpty>
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
          <Field>
            <FieldLabel>{t("languageLabel")}</FieldLabel>
            <Select value={selectedLocale ?? undefined} onValueChange={(val) => setSelectedLocale(val)}>
              <SelectTrigger>
                <SelectValue placeholder={t("languagePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {[
                  { value: "en", text: t("english") },
                  { value: "sv", text: t("swedish") },
                ].map((choice) => (
                  <SelectItem value={choice.value} key={choice.value}>
                    {choice.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-center">
            <Button
              disabled={isLoadingSettings || !selectedTimezone || isUpdatingSettings}
              onClick={() => updateSettings({ timezone: selectedTimezone!, locale: selectedLocale as "en" | "sv" })}
              className="w-1/4"
            >
              {isUpdatingSettings ? <Spinner /> : t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
