import { Header } from "@/_components/header";
import { AppSidebar } from "@/_components/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TRPCProvider } from "@/trpc/client";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Geist, Lora, Roboto_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
          <body className={`${geist.variable} ${lora.variable} ${robotoMono.variable} h-full w-full antialiased`}>
            <TooltipProvider>
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <SidebarProvider>
                  <AppSidebar />
                  <div className="flex min-h-screen w-full flex-col items-center justify-center">
                    <Header />
                    {children}
                  </div>
                  <Toaster />
                </SidebarProvider>
              </ThemeProvider>
            </TooltipProvider>
          </body>
        </html>
      </TRPCProvider>
    </ClerkProvider>
  );
};

export default RootLayout;
