import { cn } from "@/lib/utils";
import type { ReportsSnapshotTableSection } from "@/app/dashboard/reports/types";

function formatCellValue(value: number | string, format?: ReportsSnapshotTableSection["columns"][number]["format"]) {
  if (typeof value === "number") {
    if (format === "currency") {
      return `₱${value.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    if (format === "number") {
      return value.toLocaleString("en-PH");
    }
  }

  return value === "" ? "-" : String(value);
}

export function ReportsViewerDataTable(props: {
  section: ReportsSnapshotTableSection;
  compact?: boolean;
  columnWidths?: Partial<Record<string, string>>;
  cellClassNames?: Partial<Record<string, string>>;
  headerClassNames?: Partial<Record<string, string>>;
  emphasizeRowsWithValues?: string[];
}) {
  if (props.section.rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        No saved rows were captured for this section.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70">
      <div className="overflow-x-auto">
        <table
          className={cn(
            "min-w-full text-sm",
            props.columnWidths ? "w-full table-fixed" : null,
          )}
        >
          {props.columnWidths ? (
            <colgroup>
              {props.section.columns.map((column) => (
                <col key={column.key} style={{ width: props.columnWidths?.[column.key] }} />
              ))}
            </colgroup>
          ) : null}
          <thead className="bg-muted/15">
            <tr className="border-b border-border/70 text-left text-muted-foreground">
              {props.section.columns.map((column, index) => (
                <th
                  className={cn(
                    "px-4 py-3 align-top font-medium whitespace-normal break-words [overflow-wrap:anywhere]",
                    index < props.section.columns.length - 1 ? "border-r border-border/60" : null,
                    props.headerClassNames?.[column.key],
                  )}
                  key={column.key}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-background">
            {props.section.rows.map((row, index) => (
              <tr
                className={cn(
                  "align-top",
                  props.emphasizeRowsWithValues?.some((targetValue) =>
                    Object.values(row).some((value) => value === targetValue),
                  )
                    ? "bg-muted/10 font-semibold text-foreground"
                    : null,
                )}
                key={index}
              >
                {props.section.columns.map((column, columnIndex) => (
                  <td
                    className={cn(
                      "px-4 py-3 align-top",
                      columnIndex < props.section.columns.length - 1 ? "border-r border-border/60" : null,
                      props.cellClassNames?.[column.key],
                    )}
                    key={column.key}
                  >
                    {formatCellValue((row[column.key] ?? "-") as number | string, column.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
