"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { TaskList } from "@/_components/task-view/task-list";

import { use } from "react";

const Page = ({ params }: { params: Promise<{ categoryId: string }> }) => {
  const { categoryId } = use(params);

  return (
    <MaxWidthWrapper>
      <TaskList defaultCategoryId={categoryId} />
    </MaxWidthWrapper>
  );
};

export default Page;
