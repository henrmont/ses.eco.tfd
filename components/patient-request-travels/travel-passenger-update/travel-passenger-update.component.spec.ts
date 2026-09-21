import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { UpdatePassengerComponent } from './update-passenger-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdatePassengerComponent', () => {
  let component: UpdatePassengerComponent;
  let fixture: ComponentFixture<UpdatePassengerComponent>;

  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock com a estrutura exata recebida pelo componente de atualização
  const mockDialogData = {
    passenger: {
      id: 55,
      tariff: 150.00,
      tax: 12.50
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      updatePassenger: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UpdatePassengerComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: TravelService, useValue: travelServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdatePassengerComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdatePassengerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso e inicializar o formulário com os dados do passageiro recebido', () => {
    fixture.detectChanges(); // Dispara o ngOnInit e ciclo inicial

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['passengerForm']).toBeTruthy();
    expect(component['passengerForm'].get('tariff')?.value).toBe(150.00);
    expect(component['passengerForm'].get('tax')?.value).toBe(12.50);
  });

  describe('Validações do Formulário', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve invalidar o formulário se valores negativos forem inseridos', () => {
      component['passengerForm'].patchValue({
        tariff: -10,
        tax: -5
      });

      expect(component['passengerForm'].invalid).toBe(true);
      expect(component['passengerForm'].get('tariff')?.hasError('min')).toBe(true);
      expect(component['passengerForm'].get('tax')?.hasError('min')).toBe(true);
    });

    it('deve lidar de forma segura caso a propriedade passenger venha indefinida nos dados da modal', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [UpdatePassengerComponent],
        providers: [
          provideAnimationsAsync('noop'),
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: null } // Dados totalmente nulos
        ]
      });

      const localFixture = TestBed.createComponent(UpdatePassengerComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(localComponent['passengerForm'].get('tariff')?.value).toBeNull();
      expect(localComponent['passengerForm'].get('tax')?.value).toBeNull();
    });
  });

  describe('Fluxo de Submissão do Passageiro (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar o envio e marcar campos como tocados se o formulário estiver inválido', () => {
      const markAllAsTouchedSpy = vi.spyOn(component['passengerForm'], 'markAllAsTouched');
      component['passengerForm'].get('tariff')?.setValue(null); // Força invalidez
      
      component['onSubmit']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(travelServiceMock.updatePassenger).not.toHaveBeenCalled();
    });

    it('deve barrar o envio se o id do passageiro (passengerId) não for localizado', () => {
      // Sobrescreve dados injetados para simular ausência do ID
      (component as any).data = { passenger: { id: null } };

      component['onSubmit']();
      expect(travelServiceMock.updatePassenger).not.toHaveBeenCalled();
    });

    it('deve atualizar os dados com sucesso, exibir mensagem e fechar o diálogo passando true', () => {
      component['passengerForm'].patchValue({
        tariff: 180.00,
        tax: 15.00
      });

      travelServiceMock.updatePassenger.mockReturnValue(of({ message: 'Passageiro atualizado com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(travelServiceMock.updatePassenger).toHaveBeenCalledWith(55, component['passengerForm'].getRawValue());
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Passageiro atualizado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve capturar falhas estruturadas da API e renderizar a mensagem de erro vinda do backend', () => {
      const mockApiError = { error: { message: 'Erro ao processar alteração no banco de dados.' } };
      travelServiceMock.updatePassenger.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar alteração no banco de dados.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve aplicar mensagem amigável de fallback caso a API falhe cruda/sem corpo estruturado', () => {
      const mockRawError = { status: 500, statusText: 'Internal Error' };
      travelServiceMock.updatePassenger.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar a atualização do passageiro.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});