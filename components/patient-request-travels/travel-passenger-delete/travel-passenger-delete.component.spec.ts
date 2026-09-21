import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { DeletePassengerComponent } from './delete-passenger-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeletePassengerComponent', () => {
  let component: DeletePassengerComponent;
  let fixture: ComponentFixture<DeletePassengerComponent>;
  
  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    passenger: {
      id: 88,
      name: 'Carlos Silva'
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      deletePassenger: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeletePassengerComponent]
    })
    .overrideComponent(DeletePassengerComponent, {
      set: {
        providers: [
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletePassengerComponent);
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
    it('deve barrar a execução e exibir mensagem de erro se o id do passageiro não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeletePassengerComponent] })
        .overrideComponent(DeletePassengerComponent, {
          set: {
            providers: [
              { provide: TravelService, useValue: travelServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { passenger: { name: 'Sem ID' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeletePassengerComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do passageiro não encontrado.');
      expect(travelServiceMock.deletePassenger).not.toHaveBeenCalled();
    });

    it('deve remover o passageiro com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Passageiro excluído com sucesso!' };
      travelServiceMock.deletePassenger.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(travelServiceMock.deletePassenger).toHaveBeenCalledWith(88);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Passageiro excluído com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio na exclusão', () => {
      fixture.detectChanges();
      travelServiceMock.deletePassenger.mockReturnValue(of({}));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Passageiro removido com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover um passageiro com passagens já emitidas.' } };
      travelServiceMock.deletePassenger.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(travelServiceMock.deletePassenger).toHaveBeenCalledWith(88);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro estruturado', () => {
      fixture.detectChanges();
      const rawError = { status: 500 };
      travelServiceMock.deletePassenger.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover o passageiro.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});