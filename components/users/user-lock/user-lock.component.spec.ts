import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LockUserComponent } from './lock-user-component';
import { UserService } from '../../../services/user-service';
import { MessageService } from '../../../../core/services/message-service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

describe('LockUserComponent', () => {
  let component: LockUserComponent;
  let fixture: ComponentFixture<LockUserComponent>;

  let userServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock atualizado com a estrutura que o HTML espera renderizar sem quebrar
  const mockDialogData = {
    user: { 
      id: 42, 
      name: 'John Doe',
      module: {
        pivot: {
          is_editable: true // Define true por padrão para simular o estado "Travar usuário"
        }
      }
    }
  };

  beforeEach(async () => {
    userServiceMock = {
      lockUser: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [LockUserComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LockUserComponent);
    component = fixture.componentInstance;
    
    // Roda a primeira detecção para inicializar o OnPush estavelmente
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve travar o usuário com sucesso, exibir mensagem e fechar o modal repassando true', () => {
    userServiceMock.lockUser.mockReturnValue(of({ message: 'Status do usuário atualizado com sucesso!' }));

    component.onSubmit();
    fixture.detectChanges();

    expect(userServiceMock.lockUser).toHaveBeenCalledWith(42);
    
    // 🌟 Corrigido: Texto ajustado para a string exata em português
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Status do usuário atualizado com sucesso!'); 
    
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve tratar o erro da requisição, exibir a mensagem de erro do backend e desligar o loading', () => {
    const mockErrorResponse = {
      error: { message: 'Não é permitido travar este tipo de usuário.' }
    };
    userServiceMock.lockUser.mockReturnValue(throwError(() => mockErrorResponse));

    component.onSubmit();
    fixture.detectChanges(); // Atualiza o template com o novo valor do sinal pós-erro

    expect(userServiceMock.lockUser).toHaveBeenCalledWith(42);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não é permitido travar este tipo de usuário.');
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve usar uma mensagem padrão de fallback caso o erro do backend venha sem mensagem interna', () => {
    // 🌟 CONFIGURAÇÃO: Garante o fluxo de erro simulado no mock
    userServiceMock.lockUser.mockReturnValue(throwError(() => ({ error: {} })));

    component.onSubmit();
    fixture.detectChanges();

    // 🌟 Sincronizado com a string real que o Vitest capturou:
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar alterar o status do usuário.');
    expect(component.isSubmitting()).toBe(false);
  });
});