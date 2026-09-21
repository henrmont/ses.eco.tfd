import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSelectChange } from '@angular/material/select';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreateTravelComponent } from './create-travel-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreateTravelComponent', () => {
  let component: CreateTravelComponent;
  let fixture: ComponentFixture<CreateTravelComponent>;

  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 987,
      description: 'Solicitação de teste para TFD'
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      createTravel: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateTravelComponent
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
    .overrideComponent(CreateTravelComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateTravelComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário padrão com campos de data desabilitados', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['createTravelForm']).toBeTruthy();
    
    expect(component['createTravelForm'].get('departure_date')?.disabled).toBe(true);
    expect(component['createTravelForm'].get('return_date')?.disabled).toBe(true);
  });

  describe('Comportamento Reativo dos Efeitos de Data (Reactive Effects)', () => {
    
    it('deve habilitar apenas a data de ida e limpar a de volta quando o tipo selecionado for "Ida"', () => {
      fixture.detectChanges();

      // Simula a seleção alterando os Signals locais
      component['onSelection']({ value: 'Ida' } as MatSelectChange);
      fixture.detectChanges(); // Atualiza a árvore do DOM e roda os effects do Signal

      expect(component['disableDepartureDate']()).toBe(false);
      expect(component['disableReturnDate']()).toBe(true);
      expect(component['createTravelForm'].get('departure_date')?.enabled).toBe(true);
      expect(component['createTravelForm'].get('return_date')?.disabled).toBe(true);
      expect(component['createTravelForm'].get('return_date')?.value).toBeNull();
    });

    it('deve habilitar apenas a data de volta e limpar a de ida quando o tipo selecionado for "Volta"', () => {
      fixture.detectChanges();

      component['onSelection']({ value: 'Volta' } as MatSelectChange);
      fixture.detectChanges();

      expect(component['disableDepartureDate']()).toBe(true);
      expect(component['disableReturnDate']()).toBe(false);
      expect(component['createTravelForm'].get('departure_date')?.disabled).toBe(true);
      expect(component['createTravelForm'].get('departure_date')?.value).toBeNull();
      expect(component['createTravelForm'].get('return_date')?.enabled).toBe(true);
    });

    it('deve habilitar ambas as datas quando o tipo selecionado for alternativo (ex: "Ida e Volta")', () => {
      fixture.detectChanges();

      component['onSelection']({ value: 'Ida e Volta' } as MatSelectChange);
      fixture.detectChanges();

      expect(component['disableDepartureDate']()).toBe(false);
      expect(component['disableReturnDate']()).toBe(false);
      expect(component['createTravelForm'].get('departure_date')?.enabled).toBe(true);
      expect(component['createTravelForm'].get('return_date')?.enabled).toBe(true);
    });
  });

  describe('Fluxo de Submissão do Formulário de Viagem (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante que o objeto data seja resetado para o estado íntegro original antes de cada teste
      (component as any).data = {
        patient_request: {
          id: 987,
          description: 'Solicitação de teste para TFD'
        }
      };
    });

    it('deve barrar a submissão se o formulário estiver inválido (falta o campo requerido: transportation)', () => {
      expect(component['createTravelForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(travelServiceMock.createTravel).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se o ID da solicitação do paciente não existir nos dados da modal', () => {
      // Modifica apenas a instância local deste teste específico com segurança
      (component as any).data = { patient_request: null };
      component['createTravelForm'].patchValue({ transportation: 'Ônibus' });
      
      component['onSubmit']();

      expect(travelServiceMock.createTravel).not.toHaveBeenCalled();
    });

    it('deve enviar a viagem com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['createTravelForm'].patchValue({
        transportation: 'Avião',
        type: 'Ida e Volta',
        origin: 'Cuiabá',
        destination: 'São Paulo',
        description: 'Transporte de paciente para cirurgia especializada'
      });

      travelServiceMock.createTravel.mockReturnValue(of({ message: 'Viagem agendada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(travelServiceMock.createTravel).toHaveBeenCalledWith(987, expect.any(Object));
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Viagem agendada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API do servidor sem quebrar a tela', () => {
      component['createTravelForm'].patchValue({
        transportation: 'Ambulância'
      });

      const mockApiError = { error: { message: 'Inconsistência nos dados de origem/destino informados.' } };
      travelServiceMock.createTravel.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Inconsistência nos dados de origem/destino informados.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro bruto de rede sem mensagem explícita', () => {
      component['createTravelForm'].patchValue({
        transportation: 'Carro Próprio'
      });

      const mockRawError = { status: 502, statusText: 'Bad Gateway' };
      travelServiceMock.createTravel.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a criação da viagem.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});