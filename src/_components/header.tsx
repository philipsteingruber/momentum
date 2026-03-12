import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export const Header = () => {
  return (
    <header className="flex items-center justify-between py-4 pr-4 pl-8 text-lg w-full border-b-2">
      <span className="font-semibold">MOMENTUM</span>
      <Show when={"signed-in"}>
        <div className="flex items-center gap-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={"outline"}>Go to...</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <Link href={"/tasks"}>
                <DropdownMenuItem>Tasks</DropdownMenuItem>
              </Link>
              <Link href={"/categories"}>
                <DropdownMenuItem>Categories</DropdownMenuItem>
              </Link>
              <Link href={"/tags"}>
                <DropdownMenuItem>Tags</DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <UserButton />
        </div>
      </Show>
      <Show when={"signed-out"}>
        <div className="flex items-center gap-x-4">
          <SignInButton>
            <Button variant={"outline"}>Sign In</Button>
          </SignInButton>
          <SignUpButton>
            <Button>Sign Up</Button>
          </SignUpButton>
        </div>
      </Show>
    </header>
  );
};
