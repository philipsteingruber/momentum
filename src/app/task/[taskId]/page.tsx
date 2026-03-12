"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { trpc } from "@/trpc/client";
import { use } from "react";

const Page = ({ params }: { params: Promise<{ taskId: string }> }) => {
  const { taskId } = use(params);

  const { data: task, isPending: isLoadingTask } = trpc.task.getById.useQuery({ taskId });

  return <MaxWidthWrapper>{JSON.stringify(task)}</MaxWidthWrapper>;
};

export default Page;
