import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { DeleteAccountabilityDailyComponent } from './delete-accountability-daily-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteAccountabilityDailyComponent', () => {
  let component: DeleteAccountabilityDailyComponent;
  let fixture: ComponentFixture<DeleteAccountabilityDailyComponent>;
  
  let accountabilityServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    accountability_daily: {
      id: 540
    }
  };

  beforeEach(async () => {
    accountabilityServiceMock = {
      deleteAccountabilityDaily: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteAccountabilityDailyComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente OnPush
    .overrideComponent(DeleteAccountabilityDailyComponent, {
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

    fixture = TestBed.createComponent(DeleteAccountabilityDailyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    it('deve barrar a execução e exibir mensagem de erro se o accountability_daily id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeleteAccountabilityDailyComponent] })
        .overrideComponent(DeleteAccountabilityDailyComponent, {
          set: {
            providers: [
              { provide: AccountabilityService, useValue: accountabilityServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { accountability_daily: null } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeleteAccountabilityDailyComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da diária não encontrado.');
      expect(accountabilityServiceMock.deleteAccountabilityDaily).not.toHaveBeenCalled();
    });

    it('deve remover a diária com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Diária removida com sucesso!' };
      accountabilityServiceMock.deleteAccountabilityDaily.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(accountabilityServiceMock.deleteAccountabilityDaily).toHaveBeenCalledWith(540);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Diária removida com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio na exclusão', () => {
      fixture.detectChanges();
      accountabilityServiceMock.deleteAccountabilityDaily.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Diária removida com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover uma diária já processada para pagamento.' } };
      accountabilityServiceMock.deleteAccountabilityDaily.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(accountabilityServiceMock.deleteAccountabilityDaily).toHaveBeenCalledWith(540);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro estruturado', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      accountabilityServiceMock.deleteAccountabilityDaily.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover a diária.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});