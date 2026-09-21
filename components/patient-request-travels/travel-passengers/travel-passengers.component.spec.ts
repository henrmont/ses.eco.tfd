import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { TravelPassengersComponent } from './travel-passengers-component';
import { TravelService } from '../../../services/travel-service';
import { Passenger } from '../../../models/passenger';

import { CreatePassengerComponent } from '../create-passenger-component/create-passenger-component';
import { UpdatePassengerComponent } from '../update-passenger-component/update-passenger-component';
import { DeletePassengerComponent } from '../delete-passenger-component/delete-passenger-component';

describe('TravelPassengersComponent', () => {
  let component: TravelPassengersComponent;
  let fixture: ComponentFixture<TravelPassengersComponent>;

  // Mocks das dependências
  let travelServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  // Dados de entrada simulados via MAT_DIALOG_DATA
  const mockDialogData = {
    travel: {
      id: 88
    }
  };

  // Massa de dados de passageiros simulados (Misturando Paciente e Acompanhante)
  const mockPassengersResponse: any[] = [
    {
      id: 10,
      is_patient: true,
      tariff: 150.00,
      tax: 15.50,
      patient: { name: 'Adailton Silva' }
    },
    {
      id: 11,
      is_patient: false,
      tariff: 200.00,
      tax: 0.00,
      escort: { name: 'Benedita Silva' }
    }
  ];

  beforeEach(async () => {
    travelServiceMock = {
      getPassengers: vi.fn().mockReturnValue(of(mockPassengersResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula fechamento confirmando ação (true)
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [TravelPassengersComponent]
    })
    .overrideComponent(TravelPassengersComponent, {
      set: {
        providers: [
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(TravelPassengersComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo Reativo (Signals e Computed)', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de passageiros e calcular os totais individuais e globais de forma reativa', () => {
      fixture.detectChanges();

      // Verifica chamada correta do serviço usando o ID da viagem injetado
      expect(travelServiceMock.getPassengers).toHaveBeenCalledWith(88);

      // Valida o sinal bruto atualizado
      expect(component['passengersList']()).toEqual(mockPassengersResponse);

      // Valida se o computed calculou o valor total global corretamente (150 + 15.50 + 200)
      expect(component['totalValue']()).toBe(365.50);

      // Valida se o computed do dataSource montou a estrutura ideal com o campo 'total' individual embutido
      const computedDataSource = component['dataSource']();
      expect(computedDataSource).toBeInstanceOf(MatTableDataSource);
      expect(computedDataSource.data[0].total).toBe(165.50);
      expect(computedDataSource.data[1].total).toBe(200.00);

      // O spinner deve ser desativado
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e interromper o fluxo caso o id da viagem esteja ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [TravelPassengersComponent] })
        .overrideComponent(TravelPassengersComponent, {
          set: {
            providers: [
              { provide: TravelService, useValue: travelServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { travel: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(TravelPassengersComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(travelServiceMock.getPassengers).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading graciosamente mesmo se a API falhar', () => {
      travelServiceMock.getPassengers.mockReturnValue(throwError(() => new Error('Erro de API')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['passengersList']()).toEqual([]);
    });
  });

  describe('Abertura de Modais de Ação', () => {
    const targetPassenger = { id: 10, is_patient: true, tariff: 100 } as Passenger;

    beforeEach(() => {
      fixture.detectChanges(); // Inicializa o estado base dos testes
    });

    it('deve abrir a modal CreatePassengerComponent e atualizar a grid se confirmada', () => {
      travelServiceMock.getPassengers.mockClear();

      component['createPassenger']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreatePassengerComponent, {
        width: '600px',
        disableClose: true,
        autoFocus: false,
        data: { travel: mockDialogData.travel }
      });

      expect(travelServiceMock.getPassengers).toHaveBeenCalledWith(88);
    });

    it('deve abrir a modal UpdatePassengerComponent passando o registro alvo e atualizar a grid', () => {
      travelServiceMock.getPassengers.mockClear();

      component['updatePassenger'](targetPassenger);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdatePassengerComponent, {
        width: '600px',
        disableClose: true,
        autoFocus: false,
        data: { passenger: targetPassenger }
      });

      expect(travelServiceMock.getPassengers).toHaveBeenCalled();
    });

    it('deve abrir a modal DeletePassengerComponent em tamanho reduzido (400px)', () => {
      travelServiceMock.getPassengers.mockClear();

      component['deletePassenger'](targetPassenger);

      expect(dialogMock.open).toHaveBeenCalledWith(DeletePassengerComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { passenger: targetPassenger }
      });

      expect(travelServiceMock.getPassengers).toHaveBeenCalled();
    });

    it('não deve recarregar os dados se as modais forem fechadas sem ação confirmada', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      travelServiceMock.getPassengers.mockClear();

      component['updatePassenger'](targetPassenger);

      expect(travelServiceMock.getPassengers).not.toHaveBeenCalled();
    });
  });
});