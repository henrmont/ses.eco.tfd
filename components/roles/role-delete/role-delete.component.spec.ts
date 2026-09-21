import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { DeleteRoleComponent } from './delete-role-component';
import { RoleService } from '../../../services/role-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteRoleComponent', () => {
  let component: DeleteRoleComponent;
  let fixture: ComponentFixture<DeleteRoleComponent>;

  let roleServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogInputData = {
    role: {
      id: 99,
      name: 'tfd/administrador'
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    roleServiceMock = {
      deleteRole: vi.fn().mockReturnValue(of({ message: 'Regra excluída com sucesso!' }))
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteRoleComponent],
      providers: [
        { provide: RoleService, useValue: roleServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogInputData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteRoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create e herdar os dados da regra do dialog data', () => {
    expect(component).toBeTruthy();
    expect(component['data'].role).toEqual(mockDialogInputData.role);
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve executar onSubmit com sucesso, exibir mensagem e fechar o diálogo passando true', () => {
    component.onSubmit();

    expect(component.isSubmitting()).toBe(false);
    expect(roleServiceMock.deleteRole).toHaveBeenCalledWith(99);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Regra excluída com sucesso!');
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });

  it('deve capturar falhas da API no onSubmit e emitir toast com erro correspondente', () => {
    const apiError = { error: { message: 'Erro ao tentar remover a regra.' } };
    roleServiceMock.deleteRole.mockReturnValue(throwError(() => apiError));

    component.onSubmit();

    expect(component.isSubmitting()).toBe(false);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar remover a regra.');
    expect(dialogRefMock.close).not.toHaveBeenCalled();
  });
});