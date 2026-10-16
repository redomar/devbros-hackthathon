import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./ui";

type ConfirmOptions = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "gold";
  /** If set, the user must type this exact text to confirm. */
  typeToConfirm?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const dialog = pending ? <ConfirmModal options={pending} onClose={close} /> : null;
  return { confirm, dialog };
}

function ConfirmModal({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const blocked = options.typeToConfirm !== undefined && typed.trim() !== options.typeToConfirm;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-3xl border border-border bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      style={{ fontSize: 16 }}
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!blocked) onClose(true);
        }}
      >
        <h2 className="font-display text-2xl font-bold tracking-tight">{options.title}</h2>
        {options.body ? <div className="text-ink-muted">{options.body}</div> : null}
        {options.typeToConfirm ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Type {options.typeToConfirm} to confirm
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="min-h-12 rounded-xl border border-border px-3 text-base"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </label>
        ) : null}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button type="submit" variant={options.tone ?? "primary"} disabled={blocked} autoFocus={!options.typeToConfirm}>
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
