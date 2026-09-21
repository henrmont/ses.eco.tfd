import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeleteTravelComponent } from './delete-travel-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeleteTravelComponent', () => {
  let component: DeleteTravelComponent;
  let fixture: ComponentFixture<DeleteTravelComponent>;
  
  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    travel: {
      id: 250,
      destination: 'São Paulo'
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      deleteTravel: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeleteTravelComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente OnPush
    .overrideComponent(DeleteTravelComponent, {
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

    fixture = TestBed.createComponent(DeleteTravelComponent);
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
    it('deve barrar a execução e exibir mensagem de erro se o travel id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeleteTravelComponent] })
        .overrideComponent(DeleteTravelComponent, {
          set: {
            providers: [
              { provide: TravelService, useValue: travelServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { travel: { destination: 'Incompleto' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeleteTravelComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da viagem não encontrado.');
      expect(travelServiceMock.deleteTravel).not.toHaveBeenCalled();
    });

    it('deve remover a viagem com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Viagem deletada com sucesso!' };
      travelServiceMock.deleteTravel.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(travelServiceMock.deleteTravel).toHaveBeenCalledWith(250);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Viagem deletada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio na exclusão', () => {
      fixture.detectChanges();
      travelServiceMock.deleteTravel.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Viagem removida com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover uma viagem com passageiros vinculados.' } };
      travelServiceMock.deleteTravel.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(travelServiceMock.deleteTravel).toHaveBeenCalledWith(250);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro estruturado', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      travelServiceMock.deleteTravel.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover a viagem.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});