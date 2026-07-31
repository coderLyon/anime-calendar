import type { ReactNode } from "react";
import { EmptyIcon } from "../lib/icons";

export function EmptyState({ title, desc, children }: { title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <EmptyIcon />
      </div>
      <h3>{title}</h3>
      {desc ? <p>{desc}</p> : null}
      {children}
    </div>
  );
}
