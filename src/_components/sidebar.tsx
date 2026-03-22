"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { GrantStatus } from "@/generated/prisma/enums";
import { trpc } from "@/trpc/client";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export const AppSidebar = () => {
  const { data: categories } = trpc.category.getAll.useQuery({ includeTasks: true });
  const { data: grantsReceived } = trpc.sharedAccess.getGrantsReceived.useQuery();
  const acceptedGrants = grantsReceived?.filter((g) => g.status === GrantStatus.ACCEPTED) ?? [];
  const pendingCount = grantsReceived?.filter((g) => g.status === GrantStatus.PENDING).length ?? 0;
  const t = useTranslations("Sidebar");

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("categories")}</SidebarGroupLabel>
          <SidebarGroupAction>
            <PlusIcon /> <span className="sr-only">{t("addCategory")}</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories ? (
                categories?.map((category) => (
                  <SidebarMenuItem key={category.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/category/${category.id}`} className="flex items-center justify-between">
                        <span>{category.name}</span>
                        <div className="flex items-center gap-x-2">
                          {category.overdueTaskCount > 0 && (
                            <Badge variant={"destructive"}>{category.overdueTaskCount}</Badge>
                          )}
                          <Badge>{category.taskCount}</Badge>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="flex w-full items-center justify-center">
                  <Spinner />
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{t("settings")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href={"/settings"}>{t("userSettings")}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href={"/settings/discord"}>{t("discordIntegration")}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            {t("sharedWithMe")}
            {!!pendingCount && <Badge variant="destructive">{pendingCount}</Badge>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {acceptedGrants.map((grant) => (
                <SidebarMenuItem key={grant.id}>
                  <SidebarMenuButton asChild>
                    <Link href={`/shared/${grant.grantor.id}`}>
                      {grant.grantor.name ?? grant.grantor.email}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/settings/shared-access">{t("manageSharedAccess")}</Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};
