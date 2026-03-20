"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useDialogState } from "@/hooks/use-dialog-state";

interface ConfirmDeleteDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  onConfirm: () => void;
  isPending: boolean;
}

export const ConfirmDeleteDialog = ({
  trigger,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  isPending,
}: ConfirmDeleteDialogProps) => {
  const { handleOpenChange, isOpen } = useDialogState({ preventClose: isPending });

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant={"outline"}>{cancelLabel}</Button>
          </DialogClose>
          <Button variant={"destructive"} onClick={onConfirm}>
            {isPending ? <Spinner /> : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
