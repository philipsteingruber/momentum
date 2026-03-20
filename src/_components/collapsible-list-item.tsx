"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowUpDownIcon } from "lucide-react";

interface CollapsibleListItemProps {
  label: string;
  children: React.ReactNode;
}

export const CollapsibleListItem = ({ label, children }: CollapsibleListItemProps) => {
  return (
    <Collapsible className="cursor-pointer rounded border p-4">
      <CollapsibleTrigger asChild>
        <div className="flex w-full items-center justify-between">
          <span className="font-semibold">{label}</span>
          <ArrowUpDownIcon />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up cursor-default overflow-hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
