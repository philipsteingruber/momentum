"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

export const Header = () => {
  const t = useTranslations("Header");

  return (
    <header className="flex w-full items-center justify-between border-b-2 py-4 pr-4 pl-8 text-lg">
      <Link className="font-semibold" href={"/"}>
        MOMENTUM
      </Link>
      <Show when={"signed-in"}>
        <div className="flex items-center gap-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={"ghost"}>
                <MenuIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-fit">
              <Link href={"/tasks"}>
                <DropdownMenuItem>{t("tasks")}</DropdownMenuItem>
              </Link>
              <Link href={"/categories"}>
                <DropdownMenuItem>{t("categories")}</DropdownMenuItem>
              </Link>
              <Link href={"/templates"}>
                <DropdownMenuItem>{t("recurringTaskTemplates")}</DropdownMenuItem>
              </Link>
              <Separator />
              <Link href={"/settings"}>
                <DropdownMenuItem>{t("settings")}</DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <UserButton />
        </div>
      </Show>
      <Show when={"signed-out"}>
        <div className="flex items-center gap-x-4">
          <SignInButton>
            <Button variant={"outline"}>{t("signIn")}</Button>
          </SignInButton>
          <SignUpButton>
            <Button>{t("signUp")}</Button>
          </SignUpButton>
        </div>
      </Show>
    </header>
  );
};
