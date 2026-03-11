import Header from "@/_components/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCProvider } from "@/trpc/client";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Lora, Plus_Jakarta_Sans, Roboto_Mono, Geist } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const lora = Lora({
  variable: "--font-serif",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Healthcare Scheduling",
  description: "Healthcare Scheduling",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactElement => {
  return (
    <ClerkProvider>
      <TRPCProvider>
        <html lang="en" className={cn("h-full w-full", "font-sans", geist.variable)} suppressHydrationWarning>
          <body
            className={`${geist.variable} ${lora.variable} ${robotoMono.variable} h-full w-full antialiased`}
          >
            <TooltipProvider>
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <Header />
                <div className="flex min-h-screen w-full flex-col items-center justify-center">{children}</div>
                <Toaster />
              </ThemeProvider>
            </TooltipProvider>
          </body>
        </html>
      </TRPCProvider>
    </ClerkProvider>
  );
};

export default RootLayout;
