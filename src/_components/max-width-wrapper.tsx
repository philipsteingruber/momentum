import { cn } from "@/lib/utils";

export const MaxWidthWrapper = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement => {
  return (
    <div className={cn("my-4 flex min-h-screen w-5/6 flex-col items-center justify-start gap-y-4", className)}>
      {children}
    </div>
  );
};
