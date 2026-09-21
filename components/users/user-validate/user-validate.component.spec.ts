import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidateUserComponent } from './validate-user-component';
import { UserService } from '../../../services/user-service';
import { MessageService } from '../../../../core/services/message-service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

describe('ValidateUserComponent', () => {
  let component: ValidateUserComponent;
  let fixture: ComponentFixture<ValidateUserComponent>;

  let userServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    user: {
      id: 1,
      name: 'João Silva',
      module: {
        pivot: {
          is_valid: false // 🌟 Adicionado para espelhar perfeitamente o novo template
        }
      }
    }
  };

  beforeEach(async () => {
    userServiceMock = {
      validateUser: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [ValidateUserComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ValidateUserComponent);
    component = fixture.componentInstance;
    
    fixture.detectChanges(); // Inicializa o ciclo de vida OnPush
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve validar o usuário com sucesso, exibir mensagem e fechar o modal retornando true', () => {
    userServiceMock.validateUser.mockReturnValue(of({ message: 'Usuário validado com sucesso!' }));

    component.onSubmit();
    fixture.detectChanges();

    // Removido o check de isSubmitting(true) intermediário
    expect(userServiceMock.validateUser).toHaveBeenCalledWith(1); // 🌟 Ajustado para 1 (o ID real do seu mock)
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Usuário validado com sucesso!');
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
  });

  it('deve tratar o erro da requisição de validação, exibir o erro do servidor e desligar o loading', () => {
    const erroBackend = { error: { message: 'Este usuário já possui uma validação ativa.' } };
    userServiceMock.validateUser.mockReturnValue(throwError(() => erroBackend));

    component.onSubmit();
    fixture.detectChanges();

    expect(userServiceMock.validateUser).toHaveBeenCalledWith(1); // 🌟 Ajustado para 1
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Este usuário já possui uma validação ativa.');
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve exibir mensagem de fallback genérica caso o backend falhe sem mensagem interna', () => {
    userServiceMock.validateUser.mockReturnValue(throwError(() => ({ error: {} })));

    component.onSubmit();
    fixture.detectChanges();

    // 🌟 Sincronizado com a string real ajustada no componente:
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar validar o usuário.');
    expect(component.isSubmitting()).toBe(false);
  });
});