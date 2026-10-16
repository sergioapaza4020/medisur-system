import type * as React from 'react';
import type { ChangeEvent, ReactElement, ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AccountPhoto from './AccountPhoto';
import type { MyAccount } from '@/types/users';

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  changed: vi.fn(),
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  buttons: new Map<string, { onClick?: () => void; disabled?: boolean }>(),
  select: undefined as ((event: ChangeEvent<HTMLInputElement>) => void) | undefined,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = mocks.index++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] = typeof value === 'function' ? value(mocks.states[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => (mocks.refs[mocks.refIndex++] ??= { current: initial }),
}));
vi.mock('@/components/auth/AuthGuard', () => ({
  useAuth: () => ({ user: { name: 'Ana', email: 'ana@example.test' }, updateProfile: mocks.update }),
}));
vi.mock('@/services/users/myAccountService', () => ({
  myAccountService: { uploadAvatar: mocks.upload, deleteAvatar: mocks.remove },
}));
vi.mock('@mui/material/Button', () => ({
  default: ({ children, onClick, disabled }: { children: string; onClick?: () => void; disabled?: boolean }) => {
    mocks.buttons.set(children, { onClick, disabled });
    return <button disabled={disabled}>{children}</button>;
  },
}));
vi.mock('@mui/material/Dialog', () => ({
  default: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <div role='dialog'>{children}</div> : null,
}));

let account: MyAccount;
function findInput(node: ReactNode) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(findInput);
    return;
  }
  const element = node as ReactElement<{ type?: string; onChange?: typeof mocks.select; children?: ReactNode }>;
  if (element.type === 'input') mocks.select = element.props.onChange;
  findInput(element.props?.children);
}
function render() {
  mocks.index = 0;
  mocks.refIndex = 0;
  mocks.buttons.clear();
  const tree = AccountPhoto({
    account,
    onChange: (url) => {
      account = { ...account, avatarUrl: url };
      mocks.changed(url);
    },
  });
  findInput(tree);
  return renderToStaticMarkup(tree);
}
function select(file: File) {
  const target = { files: [file], value: 'photo.png' };
  mocks.select!({ target } as unknown as ChangeEvent<HTMLInputElement>);
  return target;
}
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.states = [];
  mocks.refs = [];
  account = {
    name: 'Ana',
    lastname: 'Perez',
    email: 'ana@example.test',
    ci: '123456',
    avatarUrl: null,
    avatarUpload: { maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  };
});

describe('own profile photo', () => {
  it('uses the current image or initials, accepted formats and the backend size limit', () => {
    expect(render()).toContain('5 MiB');
    expect(render()).not.toContain('<img');
    expect(mocks.buttons.get('Eliminar foto')?.disabled).toBe(true);
    account.avatarUrl = 'https://storage.example.test/current.png';
    expect(render()).toContain('src="https://storage.example.test/current.png"');
    expect(mocks.buttons.get('Eliminar foto')?.disabled).toBe(false);
  });
  it('opens the native file input from the clearly labelled button', () => {
    render();
    const click = vi.fn();
    mocks.refs[2].current = { click };
    mocks.buttons.get('Cambiar foto')!.onClick!();
    expect(click).toHaveBeenCalledOnce();
  });
  it('uploads the selected file, blocks duplicates and updates the account and global avatar', async () => {
    let complete!: (value: { avatarUrl: string; cleanupPending: boolean }) => void;
    mocks.upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    render();
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    expect(select(file).value).toBe('');
    expect(render()).toContain('Procesando foto');
    select(file);
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.upload).toHaveBeenCalledWith(file);
    complete({ avatarUrl: 'https://storage.example.test/new.png', cleanupPending: false });
    await settle();
    expect(render()).toContain('Foto de perfil actualizada');
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl: 'https://storage.example.test/new.png' }),
    );
    expect(mocks.changed).toHaveBeenCalledWith('https://storage.example.test/new.png');
  });
  it.each([
    new File(['bad'], 'photo.svg', { type: 'image/svg+xml' }),
    new File([new Uint8Array(5242881)], 'large.png', { type: 'image/png' }),
  ])('validates format and size before upload', async (file) => {
    render();
    select(file);
    await settle();
    expect(render()).toContain('Selecciona una imagen');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('preserves the current photo and reports upload errors', async () => {
    account.avatarUrl = 'https://storage.example.test/current.png';
    mocks.upload.mockRejectedValueOnce({
      isAxiosError: true,
      response: { data: { message: 'No se pudo subir la imagen' } },
    });
    render();
    select(new File(['photo'], 'photo.png', { type: 'image/png' }));
    await settle();
    expect(render()).toContain('No se pudo subir la imagen');
    expect(account.avatarUrl).toContain('current.png');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('asks for confirmation and cancellation makes no delete request', () => {
    account.avatarUrl = 'https://storage.example.test/current.png';
    render();
    mocks.buttons.get('Eliminar foto')!.onClick!();
    expect(render()).toContain('role="dialog"');
    mocks.buttons.get('Cancelar')!.onClick!();
    expect(render()).not.toContain('role="dialog"');
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('removes the photo, updates global state and returns to fallback', async () => {
    account.avatarUrl = 'https://storage.example.test/current.png';
    mocks.remove.mockResolvedValueOnce({ avatarUrl: null, cleanupPending: false });
    render();
    mocks.buttons.get('Eliminar foto')!.onClick!();
    render();
    mocks.buttons.get('Confirmar eliminación')!.onClick!();
    await settle();
    expect(render()).toContain('Foto de perfil eliminada');
    expect(render()).not.toContain('<img');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: null }));
  });
  it('keeps the dialog and photo on deletion failure', async () => {
    account.avatarUrl = 'https://storage.example.test/current.png';
    mocks.remove.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: 'No disponible' } } });
    render();
    mocks.buttons.get('Eliminar foto')!.onClick!();
    render();
    mocks.buttons.get('Confirmar eliminación')!.onClick!();
    await settle();
    expect(render()).toContain('No disponible');
    expect(account.avatarUrl).toContain('current.png');
  });
  it('reports successful update with pending cleanup without inviting a duplicate upload', async () => {
    mocks.upload.mockResolvedValueOnce({ avatarUrl: 'https://storage.example.test/new.png', cleanupPending: true });
    render();
    select(new File(['photo'], 'photo.png', { type: 'image/png' }));
    await settle();
    expect(render()).toContain('limpieza del archivo anterior quedó pendiente');
    expect(account.avatarUrl).toContain('new.png');
  });
});
