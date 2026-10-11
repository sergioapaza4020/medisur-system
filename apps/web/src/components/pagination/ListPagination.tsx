'use client';

import TablePagination from '@mui/material/TablePagination';

import type { PaginationMeta, PaginationQuery } from '@/types/pagination';

interface ListPaginationProps {
  query: PaginationQuery;
  meta: PaginationMeta;
  onChange: (pagination: PaginationQuery) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  labelRowsPerPage?: string;
}

export default function ListPagination({
  query,
  meta,
  onChange,
  pageSizeOptions = [10, 25, 50],
  disabled = false,
  labelRowsPerPage = 'Registros por página',
}: ListPaginationProps) {
  return (
    <TablePagination
      component='div'
      count={meta.total}
      page={query.page - 1}
      rowsPerPage={query.limit}
      rowsPerPageOptions={pageSizeOptions}
      disabled={disabled}
      onPageChange={(_, page) => onChange({ page: page + 1, limit: query.limit })}
      onRowsPerPageChange={(event) => onChange({ page: 1, limit: Number(event.target.value) })}
      labelRowsPerPage={labelRowsPerPage}
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      getItemAriaLabel={(type) =>
        ({ first: 'Primera página', last: 'Última página', next: 'Página siguiente', previous: 'Página anterior' })[
          type
        ]
      }
    />
  );
}
