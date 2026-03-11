"use client";

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
  const { data: categories } = trpc.category.getAll.useQuery();

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
                      <Link href={`/category/${category.id}`}>{category.name}</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="w-full flex items-center justify-center">
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
