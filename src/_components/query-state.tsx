"use client";

import { EmptyCard } from "@/_components/cards/empty-card";
import { ErrorCard } from "@/_components/cards/error-card";
import { LoadingCard } from "@/_components/cards/loading-card";
import { MaxWidthWrapper } from "@/_components/max-width-wrapper";

interface QueryStateProps {
  isPending: boolean;
  isError: boolean;
  error?: { message: string } | null;
  isEmpty?: boolean;
  title: string;
  emptyMessage?: string;
  children: React.ReactNode;
}

export const QueryState = ({ isPending, isError, error, isEmpty, title, emptyMessage, children }: QueryStateProps) => {
  if (isPending) {
    return (
      <MaxWidthWrapper>
        <LoadingCard title={title} className="w-full" />
      </MaxWidthWrapper>
    );
  }
  if (isError) {
    return (
      <MaxWidthWrapper>
        <ErrorCard title={title} error={error?.message ?? "An error occurred"} className="w-full" />
      </MaxWidthWrapper>
    );
  }
  if (isEmpty) {
    return (
      <MaxWidthWrapper>
        <EmptyCard title={title} message={emptyMessage ?? ""} />
      </MaxWidthWrapper>
    );
  }
  return <>{children}</>;
};
