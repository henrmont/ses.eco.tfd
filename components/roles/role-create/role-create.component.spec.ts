// src/app/tfd/components/roles/role-create/role-create.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleCreateComponent } from './role-create.component';
import { Permission } from '../../../../core/models/permission.model';
import { Role } from '../../../../core/models/role.model';
import { MessageService } from '../../../../core/services/message.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { RoleService } from '../../../services/role.service';

class MockBroadcastChannel {
  postMessage = vi.fn();
  close = vi.fn();
}

describe('RoleCreateComponent', () => {
  let component: RoleCreateComponent;
  let fixture: ComponentFixture<RoleCreateComponent>;

  let broadcastChannelMock: MockBroadcastChannel;
  let roleServiceMock: {
    getPermissions: ReturnType<typeof vi.fn>;
    createRole: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const mockPermissions: Permission[] = [
    { id: 1, name: 'tfd/usuário criar' } as Permission,
    { id: 2, name: 'tfd/usuário' } as Permission,
    { id: 3, name: 'tfd/regra editar' } as Permission,
    { id: 4, name: 'sem-barra' } as Permission,
  ];

  async function createComponent(
    permissionsResponse = of(mockPermissions)
  ): Promise<void> {
    roleServiceMock.getPermissions.mockReturnValue(permissionsResponse);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [RoleCreateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: RoleService, useValue: roleServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
        ],
      })
      .overrideComponent(RoleCreateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RoleCreateComponent);
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

    vi.spyOn(CustomValidators, 'permissionsValidator').mockReturnValue(() => null);

    roleServiceMock = {
      getPermissions: vi.fn(),
      createRole: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('deve criar o componente, abrir o BroadcastChannel e carregar as permissões', () => {
    expect(component).toBeTruthy();
    expect(BroadcastChannel).toHaveBeenCalledWith('tfd-roles-channel');
    expect(roleServiceMock.getPermissions).toHaveBeenCalledTimes(1);
    expect(component['permissions']()).toEqual(mockPermissions);
    expect(component['isLoading']()).toBe(false);
    expect(component['isSubmitting']()).toBe(false);
    expect(component['roleForm'].controls.name.value).toBe('');
    expect(component['selectedPermissions']).toEqual([]);
  });

  it('deve fechar o BroadcastChannel ao destruir o componente', () => {
    fixture.destroy();

    expect(broadcastChannelMock.close).toHaveBeenCalledTimes(1);
  });

  describe('Carregamento de Permissões (fetchPermissions)', () => {
    it('deve exibir mensagem de erro do backend ao falhar ao carregar permissões', async () => {
      await createComponent(
        throwError(() => ({ error: { message: 'Falha ao buscar permissões.' } }))
      );

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Falha ao buscar permissões.'
      );
      expect(component['permissions']()).toEqual([]);
      expect(component['isLoading']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro ao carregar permissões não tiver message', async () => {
      await createComponent(throwError(() => new Error('Falha de rede')));

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao carregar lista de permissões.'
      );
      expect(component['isLoading']()).toBe(false);
    });
  });

  describe('Filtro e Formatação de Permissões', () => {
    it('deve filtrar permissões pela palavra intermediária do grupo ignorando itens sem "/"', () => {
      expect(component['getFilteredRole']('usuário')).toEqual([
        mockPermissions[0],
        mockPermissions[1],
      ]);
      expect(component['getFilteredRole']('REGRA')).toEqual([mockPermissions[2]]);
      expect(component['getFilteredRole']('inexistente')).toEqual([]);
    });

    it('deve formatar o nome da permissão retornando o último segmento após "/"', () => {
      expect(component['formatPermissionName']('tfd/usuário criar')).toBe('usuário criar');
      expect(component['formatPermissionName']('simples')).toBe('simples');
      expect(component['formatPermissionName']('')).toBe('');
      expect(component['formatPermissionName'](undefined)).toBe('');
    });

    it('deve retornar false em isPermissionSelected quando o id for undefined ou zero', () => {
      expect(component['isPermissionSelected'](undefined)).toBe(false);
      expect(component['isPermissionSelected'](0)).toBe(false);
    });
  });

  describe('Seleção de Permissões (togglePermission)', () => {
    it('deve adicionar e remover permissões marcando o controle como dirty', () => {
      const permCtrl = component['roleForm'].controls.permissions;

      component['togglePermission'](mockPermissions[0]);
      fixture.detectChanges();

      expect(permCtrl.dirty).toBe(true);
      expect(component['selectedPermissions']).toEqual([1]);
      expect(component['isPermissionSelected'](1)).toBe(true);

      component['togglePermission'](mockPermissions[0]);
      fixture.detectChanges();

      expect(component['selectedPermissions']).toEqual([]);
      expect(component['isPermissionSelected'](1)).toBe(false);
    });

    it('não deve alterar permissões se o item não tiver id, isSubmitting for true ou formulário estiver desabilitado', () => {
      component['togglePermission']({ name: 'sem-id' } as Permission);
      expect(component['selectedPermissions']).toEqual([]);

      component['isSubmitting'].set(true);
      fixture.detectChanges();
      component['togglePermission'](mockPermissions[0]);
      expect(component['selectedPermissions']).toEqual([]);

      component['isSubmitting'].set(false);
      fixture.detectChanges();
      component['roleForm'].disable();
      component['togglePermission'](mockPermissions[0]);
      expect(component['selectedPermissions']).toEqual([]);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('não deve enviar a requisição se o formulário estiver inválido e deve marcar campos como tocados', () => {
      component['onSubmit']();

      expect(roleServiceMock.createRole).not.toHaveBeenCalled();
      expect(component['roleForm'].controls.name.touched).toBe(true);
      expect(component['roleForm'].controls.permissions.touched).toBe(true);
    });

    it('não deve enviar nova requisição se já estiver submetendo', () => {
      component['roleForm'].controls.name.setValue('Gestor TFD');
      component['isSubmitting'].set(true);
      fixture.detectChanges();

      component['onSubmit']();

      expect(roleServiceMock.createRole).not.toHaveBeenCalled();
    });

    it('deve criar a regra com sucesso, notificar o BroadcastChannel, exibir mensagem e fechar o dialog', () => {
      component['roleForm'].controls.name.setValue('Gestor TFD');
      component['togglePermission'](mockPermissions[0]);
      component['togglePermission'](mockPermissions[2]);
      fixture.detectChanges();

      roleServiceMock.createRole.mockReturnValue(
        of({ message: 'Regra criada!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(roleServiceMock.createRole).toHaveBeenCalledWith({
        name: 'Gestor TFD',
        permissions: [1, 3],
      } as unknown as Role);
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Regra criada!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['roleForm'].enabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      component['roleForm'].controls.name.setValue('Gestor TFD');
      roleServiceMock.createRole.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Regra criada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve desabilitar o formulário durante requisição pendente e reabilitar ao concluir', () => {
      component['roleForm'].controls.name.setValue('Gestor TFD');
      const pending$ = new Subject<{ message?: string }>();
      roleServiceMock.createRole.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(true);
      expect(component['roleForm'].disabled).toBe(true);

      pending$.next({ message: 'OK' });
      pending$.complete();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['roleForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de erro do backend e reverter o estado em caso de falha', () => {
      component['roleForm'].controls.name.setValue('Gestor TFD');
      roleServiceMock.createRole.mockReturnValue(
        throwError(() => ({ error: { message: 'Nome de regra já existe.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Nome de regra já existe.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['roleForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      component['roleForm'].controls.name.setValue('Gestor TFD');
      roleServiceMock.createRole.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao criar a regra.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});