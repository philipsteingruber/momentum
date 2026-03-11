import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export const Header = () => {
  return (
    <header className="flex items-center justify-between">
      <span className="font-semibold">MOMENTum</span>
      <Show when={"signed-in"}>
        <UserButton />
      </Show>
      <Show when={"signed-out"}>
        <SignUpButton />
        <SignInButton />
      </Show>
    </header>
  );
};
