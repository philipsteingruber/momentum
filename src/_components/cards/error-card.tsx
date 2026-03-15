import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon } from "lucide-react";
import type React from "react";

interface ErrorCardProps {
  title: string;
  error: string;
  className?: string;
}

export const ErrorCard = ({ title, error, className }: ErrorCardProps): React.ReactElement => {
  return (
    <Card className={cn("h-120", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col items-center justify-center gap-y-4">
        <AlertTriangleIcon />
        <span className="text-destructive">{error}</span>
      </CardContent>
    </Card>
  );
};
