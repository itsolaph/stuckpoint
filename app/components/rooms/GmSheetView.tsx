import {
  actionErrorMessage,
  callAction,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";
import {
  IconChevronRight,
  IconDownload,
  IconPrinter,
  IconRefresh,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { renderMarkdown } from "@/lib/markdown";

function fileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "room";
}

export function GmSheetView({ roomId }: { roomId: string }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useActionQuery("get-room", { id: roomId });
  const [generating, setGenerating] = useState(false);

  useSetPageTitle(
    <span className="flex items-center gap-1.5">
      <Link to="/home" className="text-[var(--db-muted)] hover:text-[var(--db-ink)]">
        Rooms
      </Link>
      <IconChevronRight size={14} aria-hidden="true" className="text-[var(--db-muted)]" />
      <Link
        to={`/rooms/${roomId}`}
        className="truncate text-[var(--db-muted)] hover:text-[var(--db-ink)]"
      >
        {data?.room.title ?? "…"}
      </Link>
      <IconChevronRight size={14} aria-hidden="true" className="text-[var(--db-muted)]" />
      <span>GM sheet</span>
    </span>,
  );

  async function generate() {
    setGenerating(true);
    try {
      await callAction("save-gm-sheet", { roomId });
      await qc.invalidateQueries({ queryKey: ["action", "get-room"] });
    } catch (err) {
      toast.error(actionErrorMessage(err) ?? "Could not generate the sheet.");
    } finally {
      setGenerating(false);
    }
  }

  function download(markdown: string, title: string) {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileSlug(title)}-gm-sheet.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="db-sheet" aria-busy="true">
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="db-home">
        <p className="db-empty">{actionErrorMessage(error) ?? "This room could not be opened."}</p>
      </div>
    );
  }

  const sheet = data.gmSheet;

  return (
    <div>
      <div className="db-toolbar db-no-print" role="toolbar" aria-label="GM sheet tools">
        <button
          type="button"
          className="db-btn db-btn--primary"
          disabled={generating}
          onClick={() => void generate()}
        >
          <IconRefresh size={14} aria-hidden="true" />
          {generating ? "Generating…" : sheet ? "Regenerate" : "Generate sheet"}
        </button>
        <span className="db-toolbar-spacer" />
        <button
          type="button"
          className="db-btn db-btn--sm"
          disabled={!sheet}
          onClick={() => sheet && download(sheet.markdown, data.room.title)}
        >
          <IconDownload size={14} aria-hidden="true" />
          Download .md
        </button>
        <button
          type="button"
          className="db-btn db-btn--sm"
          disabled={!sheet}
          onClick={() => window.print()}
        >
          <IconPrinter size={14} aria-hidden="true" />
          Print
        </button>
      </div>
      {sheet ? (
        <article className="db-sheet">{renderMarkdown(sheet.markdown)}</article>
      ) : (
        <div className="db-home db-no-print">
          <p className="db-empty">
            No sheet yet. Generating one walks the room, writes the walkthrough
            and props per stage, and includes any saved hint ladders. Ask the
            agent in the sidebar for a richer one.
          </p>
        </div>
      )}
    </div>
  );
}
