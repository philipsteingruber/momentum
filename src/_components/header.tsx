import { Button } from "@/components/ui/button";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export const Header = () => {
  return (
    <header className="flex items-center justify-between p-4 text-lg w-full">
      <span className="font-semibold">MOMENTUM</span>
      <Show when={"signed-in"}>
        <UserButton />
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
