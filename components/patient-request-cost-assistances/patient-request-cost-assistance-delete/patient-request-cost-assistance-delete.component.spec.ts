import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeleteCostAssistanceComponent } from './delete-cost-assistance-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteCostAssistanceComponent', () => {
  let component: DeleteCostAssistanceComponent;
  let fixture: ComponentFixture<DeleteCostAssistanceComponent>;
  
  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    cost_assistance: {
      id: 380,
      name: 'Auxílio Hospedagem Paciente'
    }
  };

  beforeEach(async () => {
    costAssistanceServiceMock = {
      deleteCostAssistance: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteCostAssistanceComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente OnPush
    .overrideComponent(DeleteCostAssistanceComponent, {
      set: {
        providers: [
          { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeleteCostAssistanceComponent);
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
    it('deve barrar a execução e exibir mensagem de erro se o cost_assistance id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeleteCostAssistanceComponent] })
        .overrideComponent(DeleteCostAssistanceComponent, {
          set: {
            providers: [
              { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { cost_assistance: { name: 'Incompleto' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeleteCostAssistanceComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da ajuda de custo não encontrado.');
      expect(costAssistanceServiceMock.deleteCostAssistance).not.toHaveBeenCalled();
    });

    it('deve remover a ajuda de custo com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Ajuda de custo removida com sucesso!' };
      costAssistanceServiceMock.deleteCostAssistance.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(costAssistanceServiceMock.deleteCostAssistance).toHaveBeenCalledWith(380);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ajuda de custo removida com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio na exclusão', () => {
      fixture.detectChanges();
      costAssistanceServiceMock.deleteCostAssistance.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ajuda de custo removida com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover uma ajuda de custo vinculada a uma diária paga.' } };
      costAssistanceServiceMock.deleteCostAssistance.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(costAssistanceServiceMock.deleteCostAssistance).toHaveBeenCalledWith(380);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro estruturado', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      costAssistanceServiceMock.deleteCostAssistance.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover a ajuda de custo.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});