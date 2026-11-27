// src/app/tfd/pages/roles-page/roles.page.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RolesPage } from './roles.page';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { Role } from '../../../core/models/role.model';
import { RoleDeleteComponent } from '../../components/roles/role-delete/role-delete.component';
import { RoleUpdateComponent } from '../../components/roles/role-update/role-update.component';
import { TfdUser } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { RoleService } from '../../services/role.service';

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
  }
}

describe('RolesPage', () => {
  let fixture: ComponentFixture<RolesPage>;
  let component: RolesPage;

  let channelMock: MockBroadcastChannel;
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let getRolesMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;
  let loadingCloseMock: ReturnType<typeof vi.fn>;
  let afterClosed$: Subject<unknown>;

  const sampleRoles = [
    {
      id: 1,
      name: 'Administrador TFD',
      permissions: [{ name: 'tfd/perfil listar' }],
    },
    {
      id: 2,
      name: 'Auditor',
      permissions: [{ name: 'perfil editar' }],
    },
    {
      id: 3,
      name: '',
      permissions: [],
    },
  ] as unknown as Role[];

  async function initPage(
    rolesStream$: Observable<Role[] | null> = of(sampleRoles),
    userValue: TfdUser | null = {
      id: 1,
      roles: [
        {
          name: 'Administrador TFD',
          permissions: [
            { name: 'tfd/perfil listar' },
            { name: 'perfil editar' },
            { name: '' },
          ],
        },
        {},
      ],
    } as unknown as TfdUser
  ): Promise<void> {
    loadingCloseMock = vi.fn();
    afterClosed$ = new Subject<unknown>();

    channelMock = new MockBroadcastChannel('tfd-roles-channel');
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return channelMock;
      })
    );

    currentUserSignal = signal<TfdUser | null>(userValue);
    getRolesMock = vi.fn(() => rolesStream$);
    dialogOpenMock = vi.fn((comp: unknown) => {
      if (comp === LoadingComponent) {
        return { close: loadingCloseMock };
      }
      return {
        afterClosed: () => afterClosed$.asObservable(),
      };
    });

    await TestBed.configureTestingModule({
      imports: [RolesPage],
      providers: [
        provideRouter([]),
        { provide: RoleService, useValue: { getRoles: getRolesMock } },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    })
      .overrideComponent(RolesPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RolesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    fixture?.destroy();
    afterClosed$?.complete();
    vi.unstubAllGlobals();
  });

  it('deve inicializar canal, carregar papéis com loading e fechar canal ao destruir', async () => {
    await initPage();

    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-roles-channel');
    expect(dialogOpenMock).toHaveBeenCalledWith(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
    expect(loadingCloseMock).toHaveBeenCalledTimes(1);
    expect(component['dataSource'].data).toEqual(sampleRoles);

    fixture.destroy();
    expect(channelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve recarregar papéis sem loading ao receber "update" no BroadcastChannel', async () => {
    await initPage();
    getRolesMock.mockClear();
    dialogOpenMock.mockClear();
    getRolesMock.mockImplementation(() => of([sampleRoles[1]]));

    channelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(getRolesMock).not.toHaveBeenCalled();

    channelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(getRolesMock).toHaveBeenCalledTimes(1);
    expect(dialogOpenMock).not.toHaveBeenCalled();
    expect(component['dataSource'].data).toEqual([sampleRoles[1]]);
  });

  it('deve manter dataSource vazio quando getRoles retornar null', async () => {
    await initPage(of(null));
    expect(component['dataSource'].data).toEqual([]);
  });

  it('deve manter dataSource vazio quando getRoles falhar', async () => {
    await initPage(throwError(() => new Error('Falha na API')));
    expect(component['dataSource'].data).toEqual([]);
  });

  it('deve filtrar dataSource, chamar firstPage no paginator e avaliar permissões e ownerRole', async () => {
    await initPage();

    const paginatorMock = {
      firstPage: vi.fn(),
      page: of(),
      _change: of(),
      initialized: of(),
    } as unknown as MatPaginator;
    component['dataSource'].paginator = paginatorMock;

    component['applyFilter']({
      target: { value: '  AUDITOR  ' },
    } as unknown as Event);

    expect(component['dataSource'].filter).toBe('auditor');
    expect(paginatorMock.firstPage).toHaveBeenCalledTimes(1);

    expect(component['checkPermissions']('perfil listar')).toBe(false);
    expect(component['checkPermissions']('perfil editar')).toBe(false);
    expect(component['checkPermissions']('perfil excluir')).toBe(true);

    expect(component['ownerRole'](sampleRoles[0])).toBe(true);
    expect(component['ownerRole'](sampleRoles[1])).toBe(false);
    expect(component['ownerRole'](sampleRoles[2])).toBe(false);

    currentUserSignal.set({ id: 1, roles: [] } as unknown as TfdUser);
    expect(component['checkPermissions']('perfil listar')).toBe(true);
    expect(component['ownerRole'](sampleRoles[0])).toBe(false);

    currentUserSignal.set(null);
    expect(component['ownerRole'](sampleRoles[0])).toBe(false);
  });

  describe('Ações da tabela', () => {
    const targetRole = sampleRoles[1];

    beforeEach(async () => {
      await initPage();
      getRolesMock.mockClear();
      channelMock.postMessage.mockClear();
    });

    it('deve abrir modal de edição (900px) e atualizar ao confirmar', () => {
      component['roleUpdate'](targetRole);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        RoleUpdateComponent,
        expect.objectContaining({
          width: '900px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { role: targetRole },
        })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getRolesMock).toHaveBeenCalledTimes(1);
      expect(channelMock.postMessage).toHaveBeenCalledTimes(1);
      expect(channelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve abrir modal de exclusão (400px) e não atualizar quando cancelado', () => {
      component['roleDelete'](targetRole);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        RoleDeleteComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { role: targetRole },
        })
      );

      afterClosed$.next(false);
      afterClosed$.complete();

      expect(getRolesMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});