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
import { useState, type ReactNode } from "react";
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
    <span className="db-crumb">
      <Link to="/home" className="db-hide-sm">
        Rooms
      </Link>
      <IconChevronRight size={14} aria-hidden="true" className="db-hide-sm text-[var(--sp-muted)]" />
      <Link to={`/rooms/${roomId}`} className="truncate">
        {data?.room.title ?? "…"}
      </Link>
      <IconChevronRight size={14} aria-hidden="true" className="text-[var(--sp-muted)]" />
      <span className="text-[var(--sp-ink)]">GM sheet</span>
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
      <div className="db-sheet-page" aria-busy="true">
        <div className="db-sheet">
          <Skeleton className="mb-4 h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="db-sheet-page">
        <p className="db-empty db-sheet-empty">
          {actionErrorMessage(error) ?? "This room could not be opened."}
        </p>
      </div>
    );
  }

  const sheet = data.gmSheet;

  return (
    <div className="db-sheet-page">
      <div className="db-sheet-tools db-no-print" role="toolbar" aria-label="GM sheet tools">
        <button
          type="button"
          className="db-btn db-btn--primary"
          disabled={generating}
          onClick={() => void generate()}
        >
          <IconRefresh size={15} aria-hidden="true" />
          {generating ? "Generating…" : sheet ? "Regenerate" : "Generate sheet"}
        </button>
        <span className="db-spacer" />
        <button
          type="button"
          className="db-btn db-btn--sm"
          disabled={!sheet}
          onClick={() => sheet && download(sheet.markdown, data.room.title)}
        >
          <IconDownload size={15} aria-hidden="true" />
          Download .md
        </button>
        <button
          type="button"
          className="db-btn db-btn--sm"
          disabled={!sheet}
          onClick={() => window.print()}
        >
          <IconPrinter size={15} aria-hidden="true" />
          Print
        </button>
      </div>
      {sheet ? (
        <article className="db-sheet">
          {sheetSections(sheet.markdown).map((sec, i) => (
            <section key={i} data-section={sec.slug}>
              {sec.slug === "intro"
                ? withKicker(renderMarkdown(sec.markdown))
                : renderMarkdown(sec.markdown)}
            </section>
          ))}
        </article>
      ) : (
        <p className="db-empty db-sheet-empty db-no-print">
          No sheet yet. Press Generate sheet to walk the room and write the
          walkthrough, the props per stage and any saved hint ladders. Ask the
          agent in the sidebar for a richer one.
        </p>
      )}
    </div>
  );
}

/** Puts a quiet "Game master sheet" line right under the room title. */
function withKicker(blocks: ReactNode[]): ReactNode[] {
  const kicker = (
    <p key="kicker" className="db-sheet-kicker">
      Game master sheet
    </p>
  );
  return blocks.length > 0 ? [blocks[0], kicker, ...blocks.slice(1)] : [kicker];
}

/**
 * Splits the sheet at its "## " headings so each part can be styled (the
 * walkthrough as a route, hint ladders as rungs). Display only: the
 * downloaded markdown is untouched.
 */
function sheetSections(markdown: string): { slug: string; markdown: string }[] {
  const out: { slug: string; lines: string[] }[] = [{ slug: "intro", lines: [] }];
  for (const raw of markdown.split("\n")) {
    const h2 = raw.match(/^##\s+(.*)$/);
    if (h2) {
      const slug = h2[1]!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      out.push({ slug, lines: [] });
    }
    let line = raw;
    if (out.length === 1) {
      // "# Title — game master sheet" reads as the room title with a quiet subtitle.
      line = line.replace(/^(#\s+.*?)\s+—\s+game master sheet\s*$/i, "$1");
      // The summary line joins its facts with commas.
      if (line.startsWith("**Playtest verdict:**")) line = line.replace(/ · /g, ", ");
    }
    out[out.length - 1]!.lines.push(line);
  }
  return out
    .map((s) => ({ slug: s.slug, markdown: s.lines.join("\n") }))
    .filter((s) => s.markdown.trim().length > 0);
}
