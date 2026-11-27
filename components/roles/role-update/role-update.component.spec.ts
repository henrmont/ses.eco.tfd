// src/app/tfd/components/roles/role-update/role-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RoleUpdateComponent, RoleUpdateDialogData } from './role-update.component';
import { Permission } from '../../../../core/models/permission.model';
import { Role } from '../../../../core/models/role.model';
import { MessageService } from '../../../../core/services/message.service';
import { CustomValidators } from '../../../../core/validators/custom.validator';
import { RoleService } from '../../../services/role.service';

describe('RoleUpdateComponent', () => {
  let component: RoleUpdateComponent;
  let fixture: ComponentFixture<RoleUpdateComponent>;

  let roleServiceMock: {
    getPermissions: ReturnType<typeof vi.fn>;
    updateRole: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: RoleUpdateDialogData | null;

  const mockPermissions: Permission[] = [
    { id: 1, name: 'tfd/usuário criar' } as Permission,
    { id: 2, name: 'tfd/usuário' } as Permission,
    { id: 3, name: 'tfd/regra editar' } as Permission,
    { id: 4, name: 'sem-barra' } as Permission,
  ];

  const baseRole: Role = {
    id: 12,
    name: 'tfd/roles/gestor',
    permissions: [
      { id: 1, name: 'tfd/usuário criar' } as Permission,
      { id: undefined, name: 'sem-id' } as unknown as Permission,
      { id: 3, name: 'tfd/regra editar' } as Permission,
    ],
  } as Role;

  async function createComponent(
    dialogData: RoleUpdateDialogData | null = { role: { ...baseRole } },
    permissionsResponse = of(mockPermissions)
  ): Promise<void> {
    mockDialogData = dialogData;
    roleServiceMock.getPermissions.mockReturnValue(permissionsResponse);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [RoleUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: RoleService, useValue: roleServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(RoleUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(RoleUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.spyOn(CustomValidators, 'permissionsValidator').mockReturnValue(() => null);

    roleServiceMock = {
      getPermissions: vi.fn(),
      updateRole: vi.fn(),
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
    vi.restoreAllMocks();
  });

  it('deve criar o componente, inicializar nome e permissões a partir de MAT_DIALOG_DATA e carregar permissões', () => {
    expect(component).toBeTruthy();
    expect(roleServiceMock.getPermissions).toHaveBeenCalledTimes(1);
    expect(component['permissions']()).toEqual(mockPermissions);
    expect(component['isLoading']()).toBe(false);
    expect(component['isSubmitting']()).toBe(false);
    expect(component['roleForm'].controls.name.value).toBe('gestor');
    expect(component['selectedPermissions']).toEqual([1, 3]);
    expect(component['isPermissionSelected'](1)).toBe(true);
    expect(component['isPermissionSelected'](2)).toBe(false);
  });

  describe('Inicialização do Formulário', () => {
    it('deve inicializar com nome vazio e permissões vazias quando MAT_DIALOG_DATA for null ou sem permissões', async () => {
      await createComponent(null);
      expect(component['roleForm'].controls.name.value).toBe('');
      expect(component['selectedPermissions']).toEqual([]);

      await createComponent({
        role: { id: 12, name: 'coordenador' } as Role,
      });
      expect(component['roleForm'].controls.name.value).toBe('coordenador');
      expect(component['selectedPermissions']).toEqual([]);
    });
  });

  describe('Carregamento de Permissões (fetchPermissions)', () => {
    it('deve exibir mensagem de erro do backend ao falhar ao carregar permissões', async () => {
      await createComponent(
        { role: { ...baseRole } },
        throwError(() => ({ error: { message: 'Falha ao buscar permissões.' } }))
      );

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Falha ao buscar permissões.'
      );
      expect(component['permissions']()).toEqual([]);
      expect(component['isLoading']()).toBe(false);
    });

    it('deve exibir mensagem de fallback quando o erro ao carregar permissões não tiver message', async () => {
      await createComponent(
        { role: { ...baseRole } },
        throwError(() => new Error('Falha de rede'))
      );

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

      component['togglePermission'](mockPermissions[1]);
      fixture.detectChanges();

      expect(permCtrl.dirty).toBe(true);
      expect(component['selectedPermissions']).toEqual([1, 3, 2]);
      expect(component['isPermissionSelected'](2)).toBe(true);

      component['togglePermission'](mockPermissions[1]);
      fixture.detectChanges();

      expect(component['selectedPermissions']).toEqual([1, 3]);
      expect(component['isPermissionSelected'](2)).toBe(false);
    });

    it('não deve alterar permissões se o item não tiver id, isSubmitting for true ou formulário estiver desabilitado', () => {
      component['togglePermission']({ name: 'sem-id' } as Permission);
      expect(component['selectedPermissions']).toEqual([1, 3]);

      component['isSubmitting'].set(true);
      fixture.detectChanges();
      component['togglePermission'](mockPermissions[1]);
      expect(component['selectedPermissions']).toEqual([1, 3]);

      component['isSubmitting'].set(false);
      fixture.detectChanges();
      component['roleForm'].disable();
      component['togglePermission'](mockPermissions[1]);
      expect(component['selectedPermissions']).toEqual([1, 3]);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('não deve enviar a requisição se o formulário estiver inválido e deve marcar campos como tocados', () => {
      component['roleForm'].controls.name.setValue('');

      component['onSubmit']();

      expect(roleServiceMock.updateRole).not.toHaveBeenCalled();
      expect(component['roleForm'].controls.name.touched).toBe(true);
      expect(component['roleForm'].controls.permissions.touched).toBe(true);
    });

    it('não deve enviar nova requisição se já estiver submetendo', () => {
      component['isSubmitting'].set(true);
      fixture.detectChanges();

      component['onSubmit']();

      expect(roleServiceMock.updateRole).not.toHaveBeenCalled();
    });

    it('deve exibir mensagem e não chamar updateRole quando roleId estiver ausente', async () => {
      await createComponent({
        role: { name: 'gestor', permissions: [{ id: 1 } as Permission] } as Role,
      });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da regra não encontrado.'
      );
      expect(roleServiceMock.updateRole).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve atualizar a regra com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      component['roleForm'].controls.name.setValue('coordenador');
      component['togglePermission'](mockPermissions[1]);
      fixture.detectChanges();

      roleServiceMock.updateRole.mockReturnValue(
        of({ message: 'Regra atualizada!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(roleServiceMock.updateRole).toHaveBeenCalledWith(12, {
        name: 'coordenador',
        permissions: [1, 3, 2],
      } as unknown as Role);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Regra atualizada!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['roleForm'].enabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      roleServiceMock.updateRole.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Regra atualizada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve desabilitar o formulário durante requisição pendente e reabilitar ao concluir', () => {
      const pending$ = new Subject<{ message?: string }>();
      roleServiceMock.updateRole.mockReturnValue(pending$.asObservable());

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
      roleServiceMock.updateRole.mockReturnValue(
        throwError(() => ({ error: { message: 'Conflito ao atualizar regra.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Conflito ao atualizar regra.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['roleForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      roleServiceMock.updateRole.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar a regra.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});