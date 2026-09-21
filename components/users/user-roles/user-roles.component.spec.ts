import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RolesUserComponent } from './roles-user-component';
import { UserService } from '../../../services/user-service';
import { MessageService } from '../../../../core/services/message-service';
import { Role } from '../../../models/role';

describe('RolesUserComponent (Vitest)', () => {
  let component: RolesUserComponent;
  let fixture: ComponentFixture<RolesUserComponent>;
  
  let mockUserService: any;
  let mockMessageService: any;
  let mockDialogRef: any;

  const mockRolesList: Role[] = [
    { id: 1, name: 'ADMINISTRADOR' },
    { id: 2, name: 'MEDICO' },
    { id: 3, name: 'OPERADOR' }
  ];

  const mockDialogData = {
    user: {
      id: 10,
      professional: { name: 'João das Neves' },
      roles: [{ id: 1, name: 'ADMINISTRADOR' }] // Começa apenas com id 1
    }
  };

  beforeEach(async () => {
    mockUserService = {
      getRoles: vi.fn().mockReturnValue(of(mockRolesList)),
      rolesUser: vi.fn()
    };

    mockMessageService = {
      showMessage: vi.fn()
    };

    mockDialogRef = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [RolesUserComponent, ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        { provide: UserService, useValue: mockUserService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: MatDialogRef, useValue: mockDialogRef }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RolesUserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente e carregar as roles iniciais', () => {
    expect(component).toBeTruthy();
    expect(mockUserService.getRoles).toHaveBeenCalled();
    expect(component.roles()).toEqual(mockRolesList);
    expect(component.isLoading()).toBe(false);
  });

  it('deve inicializar o formulário com o id do usuário e as roles mapeadas', () => {
    expect(component.rolesUserForm.get('id')?.value).toBe(10);
    expect(component.rolesUserForm.get('roles')?.value).toEqual([1]);
  });

  it('deve identificar corretamente se o usuário possui ou não determinada role', () => {
    expect(component.checkRole(1)).toBe(true);  // Tem a role 1
    expect(component.checkRole(2)).toBe(false); // Não tem a role 2
  });

  it('deve adicionar uma role ao formulário ao invocar toggleRole se ela não estiver selecionada', () => {
    const roleMedico = mockRolesList[1]; // id: 2
    component.toggleRole(roleMedico);

    expect(component.rolesUserForm.get('roles')?.value).toEqual([1, 2]);
    expect(component.rolesUserForm.pristine).toBe(false);
  });

  it('deve remover uma role do formulário ao invocar toggleRole se ela já estiver selecionada', () => {
    const roleAdmin = mockRolesList[0]; // id: 1
    component.toggleRole(roleAdmin);

    expect(component.rolesUserForm.get('roles')?.value).toEqual([]);
  });

  it('deve submeter as alterações com sucesso e fechar o modal', () => {
    // 🌟 CONFIGURAÇÃO: Adicionado retorno do mock
    mockUserService.rolesUser.mockReturnValue(of({ message: 'Permissões atualizadas com sucesso!' }));

    component.onSubmit();

    expect(mockUserService.rolesUser).toHaveBeenCalledWith(10, component.rolesUserForm.value);
    expect(mockMessageService.showMessage).toHaveBeenCalledWith('Permissões atualizadas com sucesso!');
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve tratar erro na submissão sem fechar o modal', () => {
    const mockError = { error: { message: 'Erro no servidor' } };
    mockUserService.rolesUser.mockReturnValue(throwError(() => mockError));

    component.onSubmit();

    expect(component.isSubmitting()).toBe(false);
    expect(mockMessageService.showMessage).toHaveBeenCalledWith('Erro no servidor');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });
});