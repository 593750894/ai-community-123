import {
  Download,
  FileText,
  Music,
  Video as VideoIcon,
} from "lucide-react";

import {
  categorizeAttachment,
  type AttachmentCategory,
} from "@/lib/uploads/config";
import type { MessageAttachment } from "@/lib/messages/queries";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function CategoryIcon({
  cat,
  className,
}: {
  cat: AttachmentCategory;
  className?: string;
}) {
  if (cat === "video") return <VideoIcon className={className} />;
  if (cat === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

function FileBubble({
  attachment,
  self,
}: {
  attachment: MessageAttachment;
  self: boolean;
}) {
  const cat = categorizeAttachment(attachment.mimeType);
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
        self
          ? "bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          : "bg-card/60 text-foreground/90 hover:bg-card/80"
      }`}
    >
      <CategoryIcon cat={cat} className="size-4 shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{attachment.name}</span>
        <span className="text-[10px] opacity-70">
          {formatBytes(attachment.sizeBytes)}
        </span>
      </span>
      <Download className="ml-auto size-3.5 shrink-0 opacity-70" />
    </a>
  );
}

export function MessageAttachments({
  attachments,
  self,
}: {
  attachments: MessageAttachment[];
  self: boolean;
}) {
  if (attachments.length === 0) return null;
  const singleImage =
    attachments.length === 1 &&
    categorizeAttachment(attachments[0].mimeType) === "image";

  if (singleImage) {
    const a = attachments[0];
    return (
      <a
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block max-w-xs overflow-hidden rounded-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={a.url}
          alt={a.name}
          width={a.width}
          height={a.height}
          className="block max-h-72 w-full object-cover"
        />
      </a>
    );
  }

  return (
    <div className="grid gap-2">
      {attachments.map((a, idx) => {
        const cat = categorizeAttachment(a.mimeType);
        if (cat === "image") {
          return (
            <a
              key={`${a.url}-${idx}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-xs overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                width={a.width}
                height={a.height}
                className="block max-h-48 w-full object-cover"
              />
            </a>
          );
        }
        if (cat === "video") {
          return (
            <video
              key={`${a.url}-${idx}`}
              controls
              preload="metadata"
              className="block max-h-72 w-full max-w-xs rounded-lg bg-black"
            >
              <source src={a.url} type={a.mimeType} />
              {a.name}
            </video>
          );
        }
        if (cat === "audio") {
          return (
            <audio
              key={`${a.url}-${idx}`}
              controls
              preload="metadata"
              className="block w-full max-w-xs"
            >
              <source src={a.url} type={a.mimeType} />
              {a.name}
            </audio>
          );
        }
        return (
          <FileBubble key={`${a.url}-${idx}`} attachment={a} self={self} />
        );
      })}
    </div>
  );
}
