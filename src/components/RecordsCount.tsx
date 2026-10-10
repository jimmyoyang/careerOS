"use client";

type RecordsCountProps = {
  count: number;
  total?: number;
  label?: string;
};

export function RecordsCount({
  count,
  total,
}: RecordsCountProps) {
  return (
    <div className="text-xs text-muted-foreground whitespace-nowrap">
      已显示 <strong>{count}</strong>{total !== undefined && <> / 共 <strong>{total}</strong></>} 条
    </div>
  );
}
