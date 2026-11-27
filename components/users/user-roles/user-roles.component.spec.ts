// src/app/tfd/components/users/user-roles/user-roles.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserRolesComponent, UserRolesDialogData } from './user-roles.component';
import { Role } from '../../../../core/models/role.model';
import { MessageService } from '../../../../core/services/message.service';
import { TfdUser as User } from '../../../models/user.model';
import { RoleService } from '../../../services/role.service';
import { UserService } from '../../../services/user.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('UserRolesComponent', () => {
  let component: UserRolesComponent;
  let fixture: ComponentFixture<UserRolesComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let userServiceMock: {
    rolesUser: ReturnType<typeof vi.fn>;
  };
  let roleServiceMock: {
    getRoles: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockRoles: Role[] = [
    { id: 1, name: 'tfd/users/create' } as Role,
    { id: 2, name: 'tfd/users/edit' } as Role,
    { id: 3, name: 'tfd/users/delete' } as Role,
  ];

  const baseUser: User = {
    id: 77,
    name: 'Lucas Mendes',
    professional: {
      name: 'Dr. Lucas Mendes',
    },
    roles: [{ id: 1, name: 'tfd/users/create' } as Role],
  } as unknown as User;

  async function createComponent(
    dialogData: UserRolesDialogData | null,
    rolesResponse = of(mockRoles)
  ): Promise<void> {
    roleServiceMock.getRoles.mockReturnValue(rolesResponse);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [UserRolesComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: UserService, useValue: userServiceMock },
          { provide: RoleService, useValue: roleServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(UserRolesComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserRolesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    broadcastChannelMock = new MockBroadcastChannel();

    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function () {
        return broadcastChannelMock;
      })
    );

    userServiceMock = {
      rolesUser: vi.fn(),
    };

    roleServiceMock = {
      getRoles: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent({ user: { ...baseUser, roles: [...(baseUser.roles ?? [])] } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar as permissões iniciais', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-users-channel');
    expect(roleServiceMock.getRoles).toHaveBeenCalledTimes(1);
    expect(component['roles']()).toEqual(mockRoles);
    expect(component['isLoading']()).toBe(false);
    expect(component['isSubmitting']()).toBe(false);
    expect(component['userRolesForm'].controls.roles.value).toEqual([1]);
    expect(component['checkRole'](1)).toBe(true);
    expect(component['checkRole'](2)).toBe(false);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Carregamento de Permissões (fetchRoles)', () => {
    it('deve exibir mensagem de erro do backend ao falhar ao buscar permissões e finalizar isLoading', async () => {
      await createComponent(
        { user: baseUser },
        throwError(() => ({ error: { message: 'Falha ao buscar roles.' } }))
      );

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Falha ao buscar roles.');
      expect(component['roles']()).toEqual([]);
      expect(component['isLoading']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro ao buscar roles não tiver message', async () => {
      await createComponent(
        { user: baseUser },
        throwError(() => new Error('Erro de rede'))
      );

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao carregar a lista de permissões.'
      );
      expect(component['isLoading']()).toBe(false);
    });
  });

  describe('Getters e Formatação', () => {
    it('deve priorizar professional.name, usar user.name ou retornar "Usuário"', async () => {
      expect(component['userName']).toBe('Dr. Lucas Mendes');

      await createComponent({ user: { id: 77, name: 'Lucas Mendes' } as unknown as User });
      expect(component['userName']).toBe('Lucas Mendes');

      await createComponent({ user: { id: 77 } as unknown as User });
      expect(component['userName']).toBe('Usuário');

      await createComponent(null);
      expect(component['userName']).toBe('Usuário');
    });

    it('deve formatar o nome da permissão pegando o último segmento após "/"', () => {
      expect(component['formatRoleName']('tfd/users/create')).toBe('create');
      expect(component['formatRoleName']('admin')).toBe('admin');
      expect(component['formatRoleName']('')).toBe('Sem nome');
      expect(component['formatRoleName'](undefined)).toBe('Sem nome');
    });

    it('deve retornar false em checkRole quando o id for undefined ou zero', () => {
      expect(component['checkRole'](undefined)).toBe(false);
      expect(component['checkRole'](0)).toBe(false);
    });
  });

  describe('Seleção de Permissões (toggleRole)', () => {
    it('deve adicionar e remover permissões marcando o formulário como dirty', () => {
      component['toggleRole'](mockRoles[1]);
      fixture.detectChanges();

      expect(component['userRolesForm'].dirty).toBe(true);
      expect(component['userRolesForm'].controls.roles.value).toEqual([1, 2]);
      expect(component['checkRole'](2)).toBe(true);

      component['toggleRole'](mockRoles[0]);
      fixture.detectChanges();

      expect(component['userRolesForm'].controls.roles.value).toEqual([2]);
      expect(component['checkRole'](1)).toBe(false);
    });

    it('não deve alterar permissões se o item não possuir id ou o formulário estiver desabilitado', () => {
      component['toggleRole']({ name: 'sem-id' } as Role);
      expect(component['userRolesForm'].controls.roles.value).toEqual([1]);

      component['userRolesForm'].disable();
      component['toggleRole'](mockRoles[1]);
      expect(component['userRolesForm'].controls.roles.value).toEqual([1]);
      expect(component['checkRole'](2)).toBe(false);
    });

    it('não deve alterar permissões enquanto isSubmitting estiver ativo', () => {
      component['isSubmitting'].set(true);

      component['toggleRole'](mockRoles[1]);

      expect(component['userRolesForm'].controls.roles.value).toEqual([1]);
    });
  });

  describe('Submissão de Permissões (onSubmit)', () => {
    it('deve exibir mensagem de erro e não chamar o serviço se userId estiver ausente', async () => {
      await createComponent({ user: undefined });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do usuário inválido.'
      );
      expect(userServiceMock.rolesUser).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('não deve enviar nova requisição se já estiver submetendo', () => {
      component['isSubmitting'].set(true);

      component['onSubmit']();

      expect(userServiceMock.rolesUser).not.toHaveBeenCalled();
    });

    it('deve atualizar permissões com sucesso, notificar o BroadcastChannel, exibir mensagem e fechar o dialog', () => {
      component['toggleRole'](mockRoles[1]);
      userServiceMock.rolesUser.mockReturnValue(
        of({ message: 'Permissões salvas!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(userServiceMock.rolesUser).toHaveBeenCalledWith(77, [
        mockRoles[0],
        mockRoles[1],
      ]);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Permissões salvas!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['userRolesForm'].disabled).toBe(false);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      userServiceMock.rolesUser.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Permissões atualizadas com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve manter isSubmitting true e formulário desabilitado durante requisição pendente', () => {
      const pending$ = new Subject<{ message?: string }>();
      userServiceMock.rolesUser.mockReturnValue(pending$.asObservable());

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(component['userRolesForm'].disabled).toBe(true);

      pending$.next({ message: 'Concluído' });
      pending$.complete();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['userRolesForm'].disabled).toBe(false);
    });

    it('deve exibir mensagem de erro do backend e reverter o estado em caso de falha', () => {
      userServiceMock.rolesUser.mockReturnValue(
        throwError(() => ({ error: { message: 'Permissão negada.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Permissão negada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['userRolesForm'].disabled).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      userServiceMock.rolesUser.mockReturnValue(
        throwError(() => new Error('Erro de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar permissões.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});