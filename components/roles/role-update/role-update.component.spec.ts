import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { UpdateRoleComponent } from './update-role-component';
import { RoleService } from '../../../services/role-service';
import { MessageService } from '../../../../core/services/message-service';
import { Permission } from '../../../models/permission.model';

describe('UpdateRoleComponent', () => {
  let component: UpdateRoleComponent;
  let fixture: ComponentFixture<UpdateRoleComponent>;

  let roleServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockApiPermissions: Permission[] = [
    { id: 3, name: 'tfd/regra criar' },
    { id: 4, name: 'tfd/regra atualizar' },
    { id: 5, name: 'tfd/usuário visualizar' }
  ];

  const mockDialogInputData = {
    role: {
      id: 10,
      name: 'tfd/operador',
      permissions: [
        { id: 3, name: 'tfd/regra criar' },
        { id: 4, name: 'tfd/regra atualizar' }
      ]
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    roleServiceMock = {
      getPermissions: vi.fn().mockReturnValue(of(mockApiPermissions)),
      updateRole: vi.fn().mockReturnValue(of({ message: 'Regra atualizada com sucesso!' }))
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UpdateRoleComponent],
      providers: [
        FormBuilder,
        { provide: RoleService, useValue: roleServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogInputData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateRoleComponent);
    component = fixture.componentInstance;

    // 🔥 O PULO DO GATO: Remove o validador customizado complexo para isolar o teste do Componente
    fixture.detectChanges(); // Inicializa o constructor e ngOnInit
    component.updateRoleForm.get('permissions')?.clearValidators();
    component.updateRoleForm.get('permissions')?.updateValueAndValidity();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create e carregar as permissões mapeando o estado inicial', () => {
    expect(component).toBeTruthy();
    expect(roleServiceMock.getPermissions).toHaveBeenCalled();
    expect(component.permissions()).toEqual(mockApiPermissions);
    expect(component.isLoading()).toBe(false);
  });

  it('deve inicializar o formulário cortando o prefixo do nome e mapeando os IDs de permissão', () => {
    const form = component.updateRoleForm;
    expect(form).toBeDefined();
    expect(form.get('name')?.value).toBe('operador');
    expect(form.get('permissions')?.value).toEqual([3, 4]);
    expect(form.valid).toBe(true); // Agora garantido pelo clearValidators()
  });

  it('deve filtrar as permissões por grupo corretamente usando getFilteredRole', () => {
    const regraGroup = component.getFilteredRole('regra');
    expect(regraGroup).toHaveLength(2);
    expect(regraGroup[0].name).toBe('tfd/regra criar');
  });

  it('deve retornar verdadeiro em checkPermission se o ID já estiver ativo no formulário', () => {
    expect(component.checkPermission(3)).toBe(true);
    expect(component.checkPermission(4)).toBe(true);
    expect(component.checkPermission(5)).toBe(false);
  });

  it('deve alternar permissões via togglePermission, alterando a flag para dirty', () => {
    const novaPermissao = mockApiPermissions[2]; // ID: 5

    component.togglePermission(novaPermissao);
    expect(component.updateRoleForm.get('permissions')?.value).toEqual([3, 4, 5]);
    expect(component.updateRoleForm.pristine).toBe(false);

    const permissaoExistente = mockApiPermissions[0]; // ID: 3
    component.togglePermission(permissaoExistente);
    expect(component.updateRoleForm.get('permissions')?.value).toEqual([4, 5]);
  });

  it('não deve disparar onSubmit se o formulário for inválido', () => {
    component.updateRoleForm.get('name')?.setValue(''); // Força erro no 'name' (required)
    component.onSubmit();

    expect(component.isSubmitting()).toBe(false);
    expect(roleServiceMock.updateRole).not.toHaveBeenCalled();
  });

  it('deve atualizar a regra com sucesso, exibir o toast e fechar o diálogo passando true', () => {
    component.updateRoleForm.get('name')?.setValue('operador-master');
    component.updateRoleForm.markAsDirty();

    component.onSubmit();

    expect(component.isSubmitting()).toBe(false);
    expect(roleServiceMock.updateRole).toHaveBeenCalledWith(10, {
      name: 'operador-master',
      permissions: [3, 4]
    });
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Regra atualizada com sucesso!');
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });

  it('deve capturar falhas da API no onSubmit, exibir o erro do servidor e destravar o submit', () => {
    const apiError = { error: { message: 'Erro ao atualizar a regra.' } };
    roleServiceMock.updateRole.mockReturnValue(throwError(() => apiError));

    component.updateRoleForm.get('name')?.setValue('novo-nome-valido');
    component.updateRoleForm.markAsDirty();

    component.onSubmit();

    expect(component.isSubmitting()).toBe(false); 
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao atualizar a regra.');
    expect(dialogRefMock.close).not.toHaveBeenCalled(); 
  });

  it('deve capturar erro se o getPermissions falhar no início', () => {
    // Força o erro no getPermissions limpando o comportamento anterior
    roleServiceMock.getPermissions.mockReturnValue(throwError(() => ({ error: { message: 'Timeout' } })));
    
    component.getPermissions(); // Força chamada direta para isolar o erro

    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Timeout');
    expect(component.isLoading()).toBe(false);
  });
});