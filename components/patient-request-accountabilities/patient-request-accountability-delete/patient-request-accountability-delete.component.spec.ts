import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeleteAccountabilityComponent } from './delete-accountability-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteAccountabilityComponent', () => {
  let component: DeleteAccountabilityComponent;
  let fixture: ComponentFixture<DeleteAccountabilityComponent>;
  
  let accountabilityServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    accountability: {
      id: 380,
      name: 'Prestação de Contas Outubro'
    }
  };

  beforeEach(async () => {
    accountabilityServiceMock = {
      deleteAccountability: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteAccountabilityComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente OnPush
    .overrideComponent(DeleteAccountabilityComponent, {
      set: {
        providers: [
          { provide: AccountabilityService, useValue: accountabilityServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteAccountabilityComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve inicializar com o estado de submissão desativado', () => {
      fixture.detectChanges();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    it('deve barrar a execução e exibir mensagem de erro se o accountability id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeleteAccountabilityComponent] })
        .overrideComponent(DeleteAccountabilityComponent, {
          set: {
            providers: [
              { provide: AccountabilityService, useValue: accountabilityServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { accountability: { name: 'Incompleto' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeleteAccountabilityComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da prestação de contas não encontrado.');
      expect(accountabilityServiceMock.deleteAccountability).not.toHaveBeenCalled();
    });

    it('deve remover a prestação de contas com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Prestação de contas removida com sucesso!' };
      accountabilityServiceMock.deleteAccountability.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(accountabilityServiceMock.deleteAccountability).toHaveBeenCalledWith(380);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Prestação de contas removida com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio na exclusão', () => {
      fixture.detectChanges();
      accountabilityServiceMock.deleteAccountability.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Prestação de contas removida com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover uma prestação de contas vinculada a um relatório ativo.' } };
      accountabilityServiceMock.deleteAccountability.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(accountabilityServiceMock.deleteAccountability).toHaveBeenCalledWith(380);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro estruturado', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      accountabilityServiceMock.deleteAccountability.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover a prestação de contas.');
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve bloquear chamadas duplicadas se o componente ja estiver efetuando uma submissao', () => {
      fixture.detectChanges();
      
      // Força o estado interno a estar processando uma deleção
      component['isSubmitting'].set(true);

      component['onSubmit']();

      // Garante que o serviço de deleção não foi acionado por estar bloqueado
      expect(accountabilityServiceMock.deleteAccountability).not.toHaveBeenCalled();
    });
  });
});