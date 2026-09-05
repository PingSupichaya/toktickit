import { PaginationMeta } from "../../api.js";
import { Button } from "../ui/Button.js";

const PAGE_SIZES = [10, 25, 50];

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
}

function pageNumbers(current: number, total: number): Array<number | "…"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, current, total]);
  for (let i = -1; i <= 1; i++) {
    pages.add(current + i);
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const gaps: Array<number | "…"> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) gaps.push("…");
    gaps.push(sorted[i]);
  }
  return gaps;
}

export function Pagination({
  pagination,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const { page, pageSize, totalPages, totalCount, hasPreviousPage, hasNextPage } =
    pagination;

  if (totalCount === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const pages = pageNumbers(page, totalPages);

  return (
    <nav
      className="pagination"
      data-testid="pagination"
      aria-label="Pagination"
    >
      <span className="pagination__range">
        Showing {from}–{to} of {totalCount}
      </span>

      <div className="pagination__controls">
        <Button
          variant="secondary"
          className="pagination__btn"
          disabled={disabled || !hasPreviousPage}
          onClick={() => onPageChange(page - 1)}
        >
          ‹ Prev
        </Button>
        <ul className="pagination__pages">
          {pages.map((p, i) =>
            p === "…" ? (
              <li key={`gap-${i}`} className="pagination__gap" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  className={`pagination__page${
                    p === page ? " pagination__page--active" : ""
                  }`}
                  aria-current={p === page ? "page" : undefined}
                  disabled={disabled || p === page}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              </li>
            )
          )}
        </ul>
        <Button
          variant="secondary"
          className="pagination__btn"
          disabled={disabled || !hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next ›
        </Button>
      </div>

      <label className="pagination__size">
        <span>Per page</span>
        <select
          className="select pagination__select"
          data-testid="page-size-select"
          value={pageSize}
          disabled={disabled}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}