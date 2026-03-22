"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { GrantStatus } from "@/generated/prisma/enums";
import { trpc } from "@/trpc/client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const Page = () => {
  const t = useTranslations("SharedAccessSettings");
  const trpcUtils = trpc.useUtils();

  const [inviteEmail, setInviteEmail] = useState("");

  const { data: grantsGiven, isPending: isLoadingGrantsGiven } = trpc.sharedAccess.getGrantsGiven.useQuery();
  const { data: grantsReceived, isPending: isLoadingGrantsReceived } = trpc.sharedAccess.getGrantsReceived.useQuery();

  const { mutate: invite, isPending: isInviting } = trpc.sharedAccess.invite.useMutation({
    onSuccess: () => {
      toast.success(t("inviteSuccess"));
      setInviteEmail("");
      trpcUtils.sharedAccess.getGrantsGiven.invalidate();
    },
    onError: (err) => {
      if (err.data?.code === "CONFLICT") {
        toast.error(t("alreadyInvited"));
      } else if (err.data?.code === "NOT_FOUND") {
        toast.error(t("userNotFound"));
      } else {
        toast.error(t("inviteError"));
      }
    },
  });

  const { mutate: revoke } = trpc.sharedAccess.revoke.useMutation({
    onSuccess: () => {
      toast.success(t("revokeSuccess"));
      trpcUtils.sharedAccess.getGrantsGiven.invalidate();
    },
  });

  const { mutate: respond } = trpc.sharedAccess.respond.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(variables.action === "accept" ? t("acceptSuccess") : t("declineSuccess"));
      trpcUtils.sharedAccess.getGrantsReceived.invalidate();
    },
  });

  const { mutate: remove } = trpc.sharedAccess.remove.useMutation({
    onSuccess: () => {
      toast.success(t("removeSuccess"));
      trpcUtils.sharedAccess.getGrantsReceived.invalidate();
    },
  });

  const pendingGrantsReceived = grantsReceived?.filter((g) => g.status === GrantStatus.PENDING) ?? [];
  const acceptedGrantsReceived = grantsReceived?.filter((g) => g.status === GrantStatus.ACCEPTED) ?? [];

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-y-6">
          <div className="flex flex-col gap-y-4">
            <h3 className="text-sm font-medium">{t("accessGivenTitle")}</h3>
            <div className="flex items-center gap-x-2">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("invitePlaceholder")}
                type="email"
                className="max-w-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && inviteEmail.trim()) {
                    invite({ email: inviteEmail.trim() });
                  }
                }}
              />
              <Button onClick={() => invite({ email: inviteEmail.trim() })} disabled={isInviting || !inviteEmail.trim()}>
                {isInviting ? <Spinner /> : t("inviteButton")}
              </Button>
            </div>
            {isLoadingGrantsGiven ? (
              <Spinner />
            ) : grantsGiven && grantsGiven.length > 0 ? (
              <div className="flex flex-col gap-y-2">
                {grantsGiven.map((grant) => (
                  <div key={grant.id} className="flex items-center justify-between rounded border p-3">
                    <div className="flex items-center gap-x-3">
                      <span className="text-sm">{grant.grantee.name ?? grant.grantee.email}</span>
                      <span className="text-muted-foreground text-xs">{grant.grantee.email}</span>
                      <Badge variant={grant.status === GrantStatus.ACCEPTED ? "default" : "secondary"}>
                        {grant.status === GrantStatus.ACCEPTED ? t("statusAccepted") : t("statusPending")}
                      </Badge>
                    </div>
                    <Button variant={"outline"} size={"sm"} onClick={() => revoke({ grantId: grant.id })}>
                      {t("revokeButton")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noGrantsGiven")}</p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-y-4">
            <h3 className="text-sm font-medium">{t("accessReceivedTitle")}</h3>
            {isLoadingGrantsReceived ? (
              <Spinner />
            ) : (pendingGrantsReceived.length > 0 || acceptedGrantsReceived.length > 0) ? (
              <div className="flex flex-col gap-y-2">
                {pendingGrantsReceived.map((grant) => (
                  <div key={grant.id} className="flex items-center justify-between rounded border p-3">
                    <div className="flex items-center gap-x-3">
                      <span className="text-sm">{grant.grantor.name ?? grant.grantor.email}</span>
                      <span className="text-muted-foreground text-xs">{grant.grantor.email}</span>
                      <Badge variant={"secondary"}>{t("statusPending")}</Badge>
                    </div>
                    <div className="flex items-center gap-x-2">
                      <Button
                        size={"sm"}
                        onClick={() => respond({ grantId: grant.id, action: "accept" })}
                      >
                        {t("acceptButton")}
                      </Button>
                      <Button
                        variant={"outline"}
                        size={"sm"}
                        onClick={() => respond({ grantId: grant.id, action: "decline" })}
                      >
                        {t("declineButton")}
                      </Button>
                    </div>
                  </div>
                ))}
                {acceptedGrantsReceived.map((grant) => (
                  <div key={grant.id} className="flex items-center justify-between rounded border p-3">
                    <div className="flex items-center gap-x-3">
                      <span className="text-sm">{grant.grantor.name ?? grant.grantor.email}</span>
                      <span className="text-muted-foreground text-xs">{grant.grantor.email}</span>
                      <Badge variant={"default"}>{t("statusAccepted")}</Badge>
                    </div>
                    <Button
                      variant={"outline"}
                      size={"sm"}
                      onClick={() => remove({ grantId: grant.id })}
                    >
                      {t("removeButton")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noGrantsReceived")}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default Page;
