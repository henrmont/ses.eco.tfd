import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DeleteUserComponent } from './delete-user-component';
import { UserService } from '../../../services/user-service';
import { MessageService } from '../../../../core/services/message-service';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

describe('DeleteUserComponent', () => {
  let component: DeleteUserComponent;
  let fixture: ComponentFixture<DeleteUserComponent>;

  let userServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock completo dos dados recebidos, incluindo o nome do profissional para testar o novo template
  const mockDialogData = {
    user: {
      id: 'user-789',
      professional: {
        name: 'Dr. Carlos Eduardo'
      }
    }
  };

  beforeEach(async () => {
    userServiceMock = {
      deleteUser: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteUserComponent],
      providers: [
        { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
        { provide: UserService, useValue: userServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeleteUserComponent);
    component = fixture.componentInstance;
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.isSubmitting()).toBe(false);
  });

  describe('Inicialização e Template', () => {
    it('deve exibir o nome do usuário no template se ele estiver disponível', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const contentText = compiled.querySelector('mat-dialog-content')?.textContent;
      
      expect(contentText).toContain('Dr. Carlos Eduardo');
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    
    it('deve deletar o usuário com sucesso, exibir mensagem e fechar o modal', () => {
      // 🌟 CONFIGURAÇÃO CRUCIAL: Garante que o método retorne um Observable
      userServiceMock.deleteUser.mockReturnValue(of({ message: 'Usuário removido com sucesso!' }));

      component.onSubmit();

      // Removido: expect(component.isSubmitting()).toBe(true); 👈 O mock resolve instantaneamente
      expect(userServiceMock.deleteUser).toHaveBeenCalledWith(mockDialogData.user.id);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Usuário removido com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component.isSubmitting()).toBe(false); // Mantido para checar o fim do ciclo
    });

    it('deve capturar erro do servidor com mensagem vinda do backend e reverter o signal', () => {
      const errorResponse = { error: { message: 'Erro controlado do servidor.' } };
      userServiceMock.deleteUser.mockReturnValue(throwError(() => errorResponse));

      component.onSubmit();
      fixture.detectChanges();

      expect(userServiceMock.deleteUser).toHaveBeenCalledWith(mockDialogData.user.id);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro controlado do servidor.');
      expect(component.isSubmitting()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve exibir mensagem genérica de erro caso a resposta do backend venha malformada', () => {
      // Simula uma falha crítica de rede onde o objeto `error.message` não existe (testa o fallback || do TS)
      const badErrorResponse = null; 
      userServiceMock.deleteUser.mockReturnValue(throwError(() => badErrorResponse));

      component.onSubmit();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao tentar remover o usuário.');
      expect(component.isSubmitting()).toBe(false);
    });

  });
});