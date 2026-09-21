import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

import { CreatePassengerComponent } from './create-passenger-component';
import { TravelService } from '../../../services/travel-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreatePassengerComponent', () => {
  let component: CreatePassengerComponent;
  let fixture: ComponentFixture<CreatePassengerComponent>;

  let travelServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock completo da estrutura de dados esperada do MAT_DIALOG_DATA
  const mockDialogData = {
    travel: {
      id: 99,
      patient_request: {
        report: {
          patient_care: {
            patient: { id: 1, name: 'Paciente Teste' },
            escorts: [
              { id: 2, name: 'Acompanhante Um' },
              { id: 3, name: 'Acompanhante Dois' }
            ]
          }
        }
      }
    }
  };

  beforeEach(async () => {
    travelServiceMock = {
      createPassenger: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [CreatePassengerComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: TravelService, useValue: travelServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreatePassengerComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreatePassengerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve criar o componente com sucesso e inicializar o formulário com valores padrão', () => {
    fixture.detectChanges(); // Dispara o ngOnInit

    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['passengerForm']).toBeTruthy();
    expect(component['passengerForm'].get('is_patient')?.value).toBe(false);
  });

  describe('Regras de Negócio e Chaveamento de Opções (setPassengerOptions)', () => {
    it('deve popular as opções com a lista de acompanhantes por padrão (is_patient = false)', () => {
      fixture.detectChanges();

      // Por padrão inicia em false, deve carregar os escorts
      expect(component['passengersOptions']()).toEqual(mockDialogData.travel.patient_request.report.patient_care.escorts);
    });

    it('deve mudar a lista para conter apenas o paciente quando o toggle for acionado para true', () => {
      fixture.detectChanges();

      component['passengerForm'].get('is_patient')?.setValue(true);
      
      // Simula a chamada do evento disparado pelo template
      component['onToggleChange']({ checked: true } as MatSlideToggleChange);

      expect(component['passengersOptions']()).toEqual([mockDialogData.travel.patient_request.report.patient_care.patient]);
      expect(component['passengerForm'].get('passenger')?.value).toBeNull();
    });

    it('deve lidar graciosamente definindo array vazio caso a estrutura de dados do diálogo venha incompleta', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [CreatePassengerComponent],
        providers: [
          provideAnimationsAsync('noop'),
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: { travel: null } } // Dados nulos
        ]
      });

      const localFixture = TestBed.createComponent(CreatePassengerComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(localComponent['passengersOptions']()).toEqual([]);
    });

    it('deve tratar adequadamente caso o paciente ou acompanhantes estejam ausentes nos dados internos do relatório', () => {
      const incompleteDialogData = {
        travel: {
          patient_request: {
            report: {
              patient_care: { patient: null, escorts: null }
            }
          }
        }
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [CreatePassengerComponent],
        providers: [
          provideAnimationsAsync('noop'),
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: incompleteDialogData }
        ]
      });

      const localFixture = TestBed.createComponent(CreatePassengerComponent);
      const localComponent = localFixture.componentInstance;
      
      // Testa branch true sem paciente
      localComponent['passengerForm'].get('is_patient')?.setValue(true);
      localComponent['onToggleChange']({ checked: true } as MatSlideToggleChange);
      expect(localComponent['passengersOptions']()).toEqual([]);

      // Testa branch false sem acompanhantes
      localComponent['passengerForm'].get('is_patient')?.setValue(false);
      localComponent['onToggleChange']({ checked: false } as MatSlideToggleChange);
      expect(localComponent['passengersOptions']()).toEqual([]);
    });
  });

  describe('Fluxo de Submissão do Passageiro (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve barrar o envio e marcar campos como tocados se o formulário estiver inválido', () => {
      const markAllAsTouchedSpy = vi.spyOn(component['passengerForm'], 'markAllAsTouched');
      
      component['onSubmit']();

      expect(markAllAsTouchedSpy).toHaveBeenCalled();
      expect(travelServiceMock.createPassenger).not.toHaveBeenCalled();
    });

    it('deve barrar o envio se o id da viagem (travelId) não estiver disponível nos dados injetados', () => {
      component['passengerForm'].patchValue({
        is_patient: true,
        passenger: 1,
        tariff: 120.00,
        tax: 15.00
      });

      // Sobrescreve o objeto data temporariamente simulando ausência de id
      (component as any).data = { travel: { id: null } };

      component['onSubmit']();
      expect(travelServiceMock.createPassenger).not.toHaveBeenCalled();
    });

    it('deve submeter os dados com sucesso, exibir mensagem de retorno e fechar o diálogo', () => {
      component['passengerForm'].patchValue({
        is_patient: false,
        passenger: 2,
        tariff: 250.50,
        tax: 0.00
      });

      travelServiceMock.createPassenger.mockReturnValue(of({ message: 'Passageiro adicionado com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(travelServiceMock.createPassenger).toHaveBeenCalledWith(99, component['passengerForm'].getRawValue());
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Passageiro adicionado com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve lidar de forma segura com falhas de API exibindo a mensagem do backend', () => {
      component['passengerForm'].patchValue({
        is_patient: true,
        passenger: 1,
        tariff: 100,
        tax: 10
      });

      const mockApiError = { error: { message: 'Erro de validação do banco de dados.' } };
      travelServiceMock.createPassenger.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro de validação do banco de dados.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar uma mensagem de erro genérica por fallback se a API falhar sem retornar corpo estruturado', () => {
      component['passengerForm'].patchValue({
        is_patient: true,
        passenger: 1,
        tariff: 100,
        tax: 10
      });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      travelServiceMock.createPassenger.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar o cadastro do passageiro.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});