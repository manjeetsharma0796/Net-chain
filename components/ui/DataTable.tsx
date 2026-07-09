"use client";

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Right-align numeric columns. */
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Shown when rows is empty. */
  emptyMessage?: string;
  loading?: boolean;
  caption?: string;
}

/**
 * Generic dark data table: hairline dividers, uppercase micro headers,
 * hover rows, skeleton loading state.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Nothing here yet.",
  loading = false,
  caption,
}: DataTableProps<T>) {
  return (
    <div className="glass-card overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[640px] text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-frost/10">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-frost/50 ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={`skeleton-${i}`} className="border-b border-frost/5">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-4">
                    <div className="h-3.5 animate-pulse rounded bg-frost/10" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-frost/50"
              >
                {emptyMessage}
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-frost/5 transition-colors last:border-0 hover:bg-frost/[0.04]"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3.5 align-middle ${
                      c.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
