import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSelectChange } from '@angular/material/select';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UpdateTravelComponent } from './update-travel-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateTravelComponent', () => {
  let component: UpdateTravelComponent;
  let fixture: ComponentFixture<UpdateTravelComponent>;

  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    travel: {
      id: 432,
      transportation: 'Ônibus',
      type: 'Ida e Volta',
      origin: 'Cuiabá',
      destination: 'Várzea Grande',
      departure_date: '2026-06-25',
      return_date: '2026-06-30',
      description: 'Retorno médico',
      os: '12345',
      locator: 'XYZ987'
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      updateTravel: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateTravelComponent
      ],
      providers: [
        provideNativeDateAdapter(),
        provideAnimationsAsync('noop'),
        { provide: TravelService, useValue: travelServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdateTravelComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateTravelComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário preenchido com os dados recebidos da modal', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['updateTravelForm']).toBeTruthy();
    
    expect(component['updateTravelForm'].get('transportation')?.value).toBe('Ônibus');
    expect(component['updateTravelForm'].get('os')?.value).toBe('12345');
    expect(component['updateTravelForm'].get('locator')?.value).toBe('XYZ987');
  });

  describe('Comportamento Reativo dos Efeitos de Data (Reactive Effects)', () => {
    
    it('deve habilitar apenas a data de ida e limpar/desabilitar a de volta quando o tipo modificado for "Ida"', () => {
      fixture.detectChanges();

      // Simula a alteração de seleção em tempo de execução
      component['onSelection']({ value: 'Ida' } as MatSelectChange);
      fixture.detectChanges(); // Aciona os effects reativos ligados aos Signals

      expect(component['disableDepartureDate']()).toBe(false);
      expect(component['disableReturnDate']()).toBe(true);
      expect(component['updateTravelForm'].get('departure_date')?.enabled).toBe(true);
      expect(component['updateTravelForm'].get('return_date')?.disabled).toBe(true);
      expect(component['updateTravelForm'].get('return_date')?.value).toBeNull();
    });

    it('deve habilitar apenas a data de volta e limpar/desabilitar a de ida quando o tipo modificado for "Volta"', () => {
      fixture.detectChanges();

      component['onSelection']({ value: 'Volta' } as MatSelectChange);
      fixture.detectChanges();

      expect(component['disableDepartureDate']()).toBe(true);
      expect(component['disableReturnDate']()).toBe(false);
      expect(component['updateTravelForm'].get('departure_date')?.disabled).toBe(true);
      expect(component['updateTravelForm'].get('departure_date')?.value).toBeNull();
      expect(component['updateTravelForm'].get('return_date')?.enabled).toBe(true);
    });

    it('deve habilitar ambas as datas quando o tipo modificado for alternativo (ex: "Ida e Volta")', () => {
      fixture.detectChanges();

      component['onSelection']({ value: 'Ida e Volta' } as MatSelectChange);
      fixture.detectChanges();

      expect(component['disableDepartureDate']()).toBe(false);
      expect(component['disableReturnDate']()).toBe(false);
      expect(component['updateTravelForm'].get('departure_date')?.enabled).toBe(true);
      expect(component['updateTravelForm'].get('return_date')?.enabled).toBe(true);
    });
  });

  describe('Fluxo de Submissão do Formulário de Edição (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante o reset integral do mockDialogData antes de cada teste de submissão
      (component as any).data = {
        travel: {
          id: 432,
          transportation: 'Ônibus',
          type: 'Ida e Volta',
          origin: 'Cuiabá',
          destination: 'Várzea Grande'
        }
      };
    });

    it('deve barrar a atualização se o formulário estiver inválido por falta de campo requerido', () => {
      component['updateTravelForm'].get('transportation')?.setValue(null);
      expect(component['updateTravelForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(travelServiceMock.updateTravel).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se o ID da viagem (travel id) não for fornecido nos dados da modal', () => {
      (component as any).data = { travel: null };
      
      component['onSubmit']();

      expect(travelServiceMock.updateTravel).not.toHaveBeenCalled();
    });

    it('deve enviar a atualização com sucesso via getRawValue, exibir mensagem do servidor e fechar a modal', () => {
      component['updateTravelForm'].patchValue({
        transportation: 'Avião',
        type: 'Ida',
        origin: 'Cuiabá',
        destination: 'Brasília'
      });

      travelServiceMock.updateTravel.mockReturnValue(of({ message: 'Viagem atualizada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(travelServiceMock.updateTravel).toHaveBeenCalledWith(432, expect.any(Object));
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Viagem atualizada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API caso a requisição falhe', () => {
      const mockApiError = { error: { message: 'Não é possível alterar uma viagem com escala confirmada.' } };
      travelServiceMock.updateTravel.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Não é possível alterar uma viagem com escala confirmada.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve disparar a string de fallback padrão quando o servidor retornar um erro genérico sem payload de mensagem', () => {
      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      travelServiceMock.updateTravel.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a atualização da viagem.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});