import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SearchIcon } from "lucide-react";
import type React from "react";

interface EmptyCardProps {
  title: string;
  message?: string;
  className?: string;
}

export const EmptyCard = ({ title, message, className }: EmptyCardProps): React.ReactElement => {
  return (
    <Card className={cn("h-120", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col items-center justify-center gap-y-4">
        <SearchIcon />
        <span>{message ?? "No items found."}</span>
      </CardContent>
    </Card>
  );
};
