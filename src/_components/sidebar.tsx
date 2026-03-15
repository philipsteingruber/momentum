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
import { trpc } from "@/trpc/client";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

export const AppSidebar = () => {
  const { data: categories } = trpc.category.getAll.useQuery({ includeTasks: true });

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupAction>
            <PlusIcon /> <span className="sr-only">Add Category</span>
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
      </SidebarContent>
    </Sidebar>
  );
};
