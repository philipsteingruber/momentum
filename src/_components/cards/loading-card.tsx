import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type React from "react";

interface LoadingCardProps {
  title: string;
  className?: string;
}

export const LoadingCard = ({ title, className }: LoadingCardProps): React.ReactElement => {
  return (
    <Card className={cn("h-120", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col items-center justify-center">
        <Spinner className="size-12" />
      </CardContent>
    </Card>
  );
};
