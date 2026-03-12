import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { TaskList } from "@/_components/task-view/task-list";

export default function Home() {
  return (
    <MaxWidthWrapper>
      <TaskList />
    </MaxWidthWrapper>
  );
}
