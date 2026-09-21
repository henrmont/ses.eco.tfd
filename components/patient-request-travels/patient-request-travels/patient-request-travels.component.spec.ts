import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PatientRequestTravelsComponent } from './patient-request-travels-component';
import { TravelService } from '../../../services/travel-service';
import { Travel } from '../../../models/travel';

import { CreateTravelComponent } from '../create-travel-component/create-travel-component';
import { ShowTravelComponent } from '../show-travel-component/show-travel-component';
import { UpdateTravelComponent } from '../update-travel-component/update-travel-component';
import { DeleteTravelComponent } from '../delete-travel-component/delete-travel-component';
import { TravelPassengersComponent } from '../travel-passengers-component/travel-passengers-component';
import { TravelRoutesComponent } from '../travel-routes-component/travel-routes-component';

describe('PatientRequestTravelsComponent', () => {
  let component: PatientRequestTravelsComponent;
  let fixture: ComponentFixture<PatientRequestTravelsComponent>;

  // Mocks das dependências
  let travelServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;

  // Dados de entrada simulados via MAT_DIALOG_DATA com estrutura de permissões inclusa
  const mockDialogData = {
    patient_request: {
      id: 740
    },
    permissions: [
      {
        permissions: [
          { name: 'CREATE_TRAVEL' },
          { name: 'UPDATE_TRAVEL' }
        ]
      }
    ]
  };

  // Massa de dados de viagens simuladas
  const mockTravelsResponse: Travel[] = [
    { id: 1, os: 'OS-2026/001', origin: 'Cuiabá', destination: 'São Paulo', departure_date: '2026-06-25T12:00:00Z' } as Travel,
    { id: 2, os: 'OS-2026/002', origin: 'Rondonópolis', destination: 'Goiânia', departure_date: '2026-07-02T08:30:00Z' } as Travel
  ];

  beforeEach(async () => {
    travelServiceMock = {
      getTravels: vi.fn().mockReturnValue(of(mockTravelsResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula fechamento com confirmação (true)
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [PatientRequestTravelsComponent]
    })
    .overrideComponent(PatientRequestTravelsComponent, {
      set: {
        providers: [
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestTravelsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo de Carga Inicial', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges(); // Dispara o ngOnInit
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de viagens reativamente e alimentar o dataSource (computed)', () => {
      fixture.detectChanges();

      // Garante que chamou o serviço usando o ID da solicitação correto
      expect(travelServiceMock.getTravels).toHaveBeenCalledWith(740);
      
      // Valida se o sinal bruto foi adequadamente atualizado
      expect(component['travelsList']()).toEqual(mockTravelsResponse);
      
      // Valida se o computed do dataSource gerou a instância correta com os dados populados
      expect(component['dataSource']()).toBeInstanceOf(MatTableDataSource);
      expect(component['dataSource']().data).toEqual(mockTravelsResponse);
      
      // O loading deve ter sido desativado ao concluir
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e não quebrar se o id da solicitação estiver ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PatientRequestTravelsComponent] })
        .overrideComponent(PatientRequestTravelsComponent, {
          set: {
            providers: [
              { provide: TravelService, useValue: travelServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(PatientRequestTravelsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(travelServiceMock.getTravels).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading mesmo se a API falhar no ciclo de inicialização', () => {
      travelServiceMock.getTravels.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['travelsList']()).toEqual([]);
    });
  });

  describe('Validação de Regras de Acesso (checkPermissions)', () => {
    it('deve retornar false se a permissão informada constar no array de papéis recebido', () => {
      fixture.detectChanges();
      const result = component['checkPermissions']('CREATE_TRAVEL');
      expect(result).toBe(false);
    });

    it('deve retornar true se a permissão especificada não for localizada no array de papéis', () => {
      fixture.detectChanges();
      const result = component['checkPermissions']('DELETE_TRAVEL');
      expect(result).toBe(true);
    });

    it('deve retornar true por padrão e tratar graciosamente se o array de permissões estiver ausente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PatientRequestTravelsComponent] })
        .overrideComponent(PatientRequestTravelsComponent, {
          set: {
            providers: [
              { provide: TravelService, useValue: travelServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_request: { id: 740 }, permissions: null } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(PatientRequestTravelsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      const result = localComponent['checkPermissions']('CREATE_TRAVEL');
      expect(result).toBe(true);
    });
  });

  describe('Abertura de Modais e Fluxos de Ação', () => {
    const targetTravel = { id: 1, os: 'OS-01', origin: 'X', destination: 'Y' } as Travel;

    beforeEach(() => {
      fixture.detectChanges(); // Inicializa o estado reativo base
    });

    it('deve abrir a modal CreateTravelComponent e atualizar a grid com loading de feedback se houver confirmação', () => {
      travelServiceMock.getTravels.mockClear();

      component['createTravel']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateTravelComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_request: mockDialogData.patient_request }
      });

      // Como o mock do dialogRef devolve 'true', a recarga reativa deve ser acionada:
      expect(travelServiceMock.getTravels).toHaveBeenCalledWith(740);
    });

    it('deve abrir a modal ShowTravelComponent em modo de visualização pura', () => {
      component['showTravel'](targetTravel);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowTravelComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { travel: targetTravel }
      });
    });

    it('deve abrir a modal UpdateTravelComponent e atualizar registros fluidamente com loading ativo se confirmada', () => {
      travelServiceMock.getTravels.mockClear();

      component['updateTravel'](targetTravel);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateTravelComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { travel: targetTravel }
      });

      expect(travelServiceMock.getTravels).toHaveBeenCalled();
    });

    it('deve abrir a modal DeleteTravelComponent usando largura reduzida (400px) e acionar atualização ao fechar', () => {
      travelServiceMock.getTravels.mockClear();

      component['deleteTravel'](targetTravel);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteTravelComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { travel: targetTravel }
      });

      expect(travelServiceMock.getTravels).toHaveBeenCalled();
    });

    it('deve abrir a modal ampliada de gerenciamento de Passageiros (TravelPassengersComponent)', () => {
      component['passengers'](targetTravel);

      expect(dialogMock.open).toHaveBeenCalledWith(TravelPassengersComponent, {
        width: '1200px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { travel: targetTravel }
      });
    });

    it('deve abrir a modal de visualização/gerenciamento de rotas (TravelRoutesComponent)', () => {
      component['routes'](targetTravel);

      expect(dialogMock.open).toHaveBeenCalledWith(TravelRoutesComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { travel: targetTravel }
      });
    });

    it('não deve recarregar a listagem de viagens se as modais forem fechadas sem confirmação (retorno falso/nulo)', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      travelServiceMock.getTravels.mockClear();

      component['updateTravel'](targetTravel);

      expect(travelServiceMock.getTravels).not.toHaveBeenCalled();
    });
  });
});