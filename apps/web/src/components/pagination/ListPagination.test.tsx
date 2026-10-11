import type { ChangeEvent } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ListPagination from './ListPagination';

import { usersService } from '@/services/users/usersService';
import { apiClient } from '@/services/http/axiosClient';
import type { UsersQuery } from '@/types/users';

vi.mock('@/services/http/axiosClient', () => ({ apiClient: { get: vi.fn() } }));

describe('Shared list pagination using MUI', () => {
  it('converts between API and MUI page numbering and renders record totals', () => {
    const onChange = vi.fn();
    const element = ListPagination({
      query: { page: 2, limit: 10 },
      meta: { page: 2, limit: 10, total: 57, totalPages: 6 },
      onChange,
    });
    expect(element.props.page).toBe(1);
    expect(element.props.count).toBe(57);
    expect(renderToStaticMarkup(element)).toContain('11–20 de 57');
    element.props.onPageChange(null, 2);
    expect(onChange).toHaveBeenCalledWith({ page: 3, limit: 10 });
    element.props.onPageChange(null, 0);
    expect(onChange).toHaveBeenLastCalledWith({ page: 1, limit: 10 });
  });

  it('resets to the first page on a size change and supports fixed size and loading controls', () => {
    const onChange = vi.fn();
    const element = ListPagination({
      query: { page: 3, limit: 10 },
      meta: { page: 3, limit: 10, total: 57, totalPages: 6 },
      onChange,
      disabled: true,
      pageSizeOptions: [10],
    });
    expect(element.props.disabled).toBe(true);
    expect(element.props.rowsPerPageOptions).toEqual([10]);
    element.props.onRowsPerPageChange({ target: { value: '25' } } as ChangeEvent<HTMLInputElement>);
    expect(onChange).toHaveBeenCalledWith({ page: 1, limit: 25 });
  });

  it('renders an empty result with zero records', () => {
    const html = renderToStaticMarkup(
      ListPagination({
        query: { page: 1, limit: 10 },
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain('0–0 de 0');
    expect(html).toContain('Página siguiente');
  });

  it('requests the changed page and limit through the users service while retaining active filters', async () => {
    let query: UsersQuery = { page: 1, limit: 10, status: 'inactive', search: 'Ana' };
    const onChange = (pagination: { page: number; limit: number }) => {
      query = { ...query, ...pagination };
    };
    const meta = { page: 1, limit: 10, total: 57, totalPages: 6 };
    const next = { status: true, statusCode: 200, data: [{ idUser: 11 }], meta: { ...meta, page: 2 } };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: next });
    ListPagination({ query, meta, onChange }).props.onPageChange(null, 1);
    expect(await usersService.list(query)).toEqual(next);
    expect(apiClient.get).toHaveBeenLastCalledWith('/users', {
      params: { page: 2, limit: 10, status: 'inactive', search: 'Ana' },
    });
    const resized = { ...next, data: [{ idUser: 1 }], meta: { page: 1, limit: 25, total: 57, totalPages: 3 } };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: resized });
    ListPagination({ query, meta: next.meta, onChange }).props.onRowsPerPageChange({
      target: { value: '25' },
    } as ChangeEvent<HTMLInputElement>);
    expect(await usersService.list(query)).toEqual(resized);
    expect(apiClient.get).toHaveBeenLastCalledWith('/users', {
      params: { page: 1, limit: 25, status: 'inactive', search: 'Ana' },
    });
  });
});
