// src/app/tfd/pages/users-page/users.page.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsersPage } from './users.page';
import { LoadingComponent } from '../../../core/components/loading-component/loading-component';
import { UserDeleteComponent } from '../../components/users/user-delete/user-delete.component';
import { UserDetailComponent } from '../../components/users/user-detail/user-detail.component';
import { UserLockComponent } from '../../components/users/user-lock/user-lock.component';
import { UserRolesComponent } from '../../components/users/user-roles/user-roles.component';
import { UserUpdateComponent } from '../../components/users/user-update/user-update.component';
import { UserValidateComponent } from '../../components/users/user-validate/user-validate.component';
import { TfdUser } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
  }
}

describe('UsersPage', () => {
  let fixture: ComponentFixture<UsersPage>;
  let component: UsersPage;

  let channelMock: MockBroadcastChannel;
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let getUsersMock: ReturnType<typeof vi.fn>;
  let dialogOpenMock: ReturnType<typeof vi.fn>;
  let loadingCloseMock: ReturnType<typeof vi.fn>;
  let afterClosed$: Subject<unknown>;

  const longName = 'Ana Carolina de Albuquerque Vasconcelos Oliveira';
  const truncatedLongName = `${longName.slice(0, 32)} ...${longName.slice(-5)}`;

  const sampleUsers = [
    {
      id: 1,
      email: 'logado@exemplo.com',
      name: 'Usuário Logado',
      professional: { name: 'Usuário Logado', cns: '111' },
      module: { pivot: { is_editable: false } },
    },
    {
      id: 2,
      email: 'ana@exemplo.com',
      name: longName,
      professional: { name: longName, cns: '222' },
      module: { pivot: { is_editable: false } },
    },
    {
      id: 3,
      email: 'travado@exemplo.com',
      professional: { cns: '333' },
      module: { pivot: { is_editable: true } },
    },
    {
      id: 4,
      email: 'basico@exemplo.com',
      name: '',
    },
  ] as unknown as TfdUser[];

  async function initPage(
    usersStream$: Observable<TfdUser[] | null> = of(sampleUsers),
    userValue: TfdUser | null = {
      id: 1,
      roles: [
        {
          permissions: [
            { name: 'tfd/usuário listar' },
            { name: 'usuário editar' },
            { name: '' },
          ],
        },
        {},
      ],
    } as unknown as TfdUser
  ): Promise<void> {
    loadingCloseMock = vi.fn();
    afterClosed$ = new Subject<unknown>();

    channelMock = new MockBroadcastChannel('tfd-users-channel');
    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return channelMock;
      })
    );

    currentUserSignal = signal<TfdUser | null>(userValue);
    getUsersMock = vi.fn(() => usersStream$);
    dialogOpenMock = vi.fn((comp: unknown) => {
      if (comp === LoadingComponent) {
        return { close: loadingCloseMock };
      }
      return {
        afterClosed: () => afterClosed$.asObservable(),
      };
    });

    await TestBed.configureTestingModule({
      imports: [UsersPage],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: { getUsers: getUsersMock } },
        { provide: AuthService, useValue: { currentUser: currentUserSignal } },
        { provide: MatDialog, useValue: { open: dialogOpenMock } },
      ],
    })
      .overrideComponent(UsersPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UsersPage);
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

  it('deve inicializar canal, carregar e mapear usuários com loading e fechar canal ao destruir', async () => {
    await initPage();

    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-users-channel');
    expect(dialogOpenMock).toHaveBeenCalledWith(LoadingComponent, {
      height: '200px',
      disableClose: true,
      autoFocus: false,
    });
    expect(loadingCloseMock).toHaveBeenCalledTimes(1);

    expect(component['dataSource'].data).toEqual([
      expect.objectContaining({
        id: 1,
        name: 'Usuário Logado',
        cns: '111',
        is_editable: false,
      }),
      expect.objectContaining({
        id: 2,
        name: truncatedLongName,
        cns: '222',
        is_editable: true,
      }),
      expect.objectContaining({
        id: 3,
        name: '-',
        cns: '333',
        is_editable: false,
      }),
      expect.objectContaining({
        id: 4,
        name: '-',
        cns: '-',
        is_editable: true,
      }),
    ]);

    fixture.destroy();
    expect(channelMock.close).toHaveBeenCalledTimes(1);
  });

  it('deve recarregar usuários sem loading ao receber "update" no BroadcastChannel', async () => {
    await initPage();
    getUsersMock.mockClear();
    dialogOpenMock.mockClear();
    getUsersMock.mockImplementation(() => of([sampleUsers[1]]));

    channelMock.onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(getUsersMock).not.toHaveBeenCalled();

    channelMock.onmessage?.({ data: 'update' } as MessageEvent<string>);
    expect(getUsersMock).toHaveBeenCalledTimes(1);
    expect(dialogOpenMock).not.toHaveBeenCalled();
    expect(component['dataSource'].data).toHaveLength(1);
  });

  it('deve manter dataSource vazio quando getUsers retornar null', async () => {
    await initPage(of(null));
    expect(component['dataSource'].data).toEqual([]);
  });

  it('deve manter dataSource vazio quando getUsers falhar', async () => {
    await initPage(throwError(() => new Error('Falha na API')));
    expect(component['dataSource'].data).toEqual([]);
  });

  it('deve filtrar dataSource, chamar firstPage no paginator e avaliar permissões', async () => {
    await initPage();

    const paginatorMock = {
      firstPage: vi.fn(),
      page: of(),
      _change: of(),
      initialized: of(),
    } as unknown as MatPaginator;
    component['dataSource'].paginator = paginatorMock;

    component['applyFilter']({
      target: { value: '  ANA@EXEMPLO.COM  ' },
    } as unknown as Event);

    expect(component['dataSource'].filter).toBe('ana@exemplo.com');
    expect(paginatorMock.firstPage).toHaveBeenCalledTimes(1);

    expect(component['checkPermissions']('usuário listar')).toBe(false);
    expect(component['checkPermissions']('usuário editar')).toBe(false);
    expect(component['checkPermissions']('usuário excluir')).toBe(true);

    currentUserSignal.set({ id: 1, roles: [] } as unknown as TfdUser);
    expect(component['checkPermissions']('usuário listar')).toBe(true);

    currentUserSignal.set(null);
    expect(component['calculateEditable'](sampleUsers[1])).toBe(false);
  });

  describe('Ações da tabela', () => {
    const targetUser = sampleUsers[1];

    beforeEach(async () => {
      await initPage();
      getUsersMock.mockClear();
      channelMock.postMessage.mockClear();
    });

    it('deve abrir modais de 400px (lock, validate, delete) e atualizar ao confirmar', () => {
      component['userLock'](targetUser);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        UserLockComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { user: targetUser },
        })
      );

      component['userValidate'](targetUser);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        UserValidateComponent,
        expect.objectContaining({ width: '400px', data: { user: targetUser } })
      );

      component['userDelete'](targetUser);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        UserDeleteComponent,
        expect.objectContaining({ width: '400px', data: { user: targetUser } })
      );

      afterClosed$.next(true);
      afterClosed$.complete();

      expect(getUsersMock).toHaveBeenCalledTimes(3);
      expect(channelMock.postMessage).toHaveBeenCalledTimes(3);
      expect(channelMock.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve abrir modais de 700px (roles, update, detail) e não atualizar quando cancelado', () => {
      component['userRoles'](targetUser);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        UserRolesComponent,
        expect.objectContaining({ width: '700px', data: { user: targetUser } })
      );

      component['userUpdate'](targetUser);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        UserUpdateComponent,
        expect.objectContaining({ width: '700px', data: { user: targetUser } })
      );

      component['userDetail'](targetUser);
      expect(dialogOpenMock).toHaveBeenCalledWith(
        UserDetailComponent,
        expect.objectContaining({ width: '700px', data: { user: targetUser } })
      );

      afterClosed$.next(false);
      afterClosed$.complete();

      expect(getUsersMock).not.toHaveBeenCalled();
      expect(channelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});