import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { TravelRoutesComponent } from './travel-routes-component';
import { TravelService } from '../../../services/travel-service';
import { Route } from '../../../models/route';

import { CreateRouteComponent } from '../create-route-component/create-route-component';
import { UpdateRouteComponent } from '../update-route-component/update-route-component';
import { DeleteRouteComponent } from '../delete-route-component/delete-route-component';

describe('TravelRoutesComponent', () => {
  let component: TravelRoutesComponent;
  let fixture: ComponentFixture<TravelRoutesComponent>;

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

  // Massa de dados de rotas simuladas
  const mockRoutesResponse: Route[] = [
    {
      id: 1,
      ticket_id: 88,
      from: 'Cuiabá',
      to: 'Rondonópolis',
      distance: 215.50
    },
    {
      id: 2,
      ticket_id: 88,
      from: 'Rondonópolis',
      to: 'Goiânia',
      distance: 630.00
    }
  ];

  beforeEach(async () => {
    travelServiceMock = {
      getRoutes: vi.fn().mockReturnValue(of(mockRoutesResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula fechamento confirmando ação (true)
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    await TestBed.configureTestingModule({
      imports: [TravelRoutesComponent]
    })
    .overrideComponent(TravelRoutesComponent, {
      set: {
        providers: [
          { provide: TravelService, useValue: travelServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(TravelRoutesComponent);
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

    it('deve carregar a lista de rotas e calcular a distância total global de forma reativa', () => {
      fixture.detectChanges();

      // Verifica chamada correta do serviço usando o ID da viagem injetado
      expect(travelServiceMock.getRoutes).toHaveBeenCalledWith(88);

      // Valida o sinal bruto atualizado
      expect(component['routesList']()).toEqual(mockRoutesResponse);

      // Valida se o computed calculou o valor total de distância corretamente (215.50 + 630.00)
      expect(component['totalDistance']()).toBe(845.50);

      // Valida se o computed do dataSource montou a estrutura ideal contendo os elementos do array
      const computedDataSource = component['dataSource']();
      expect(computedDataSource).toBeInstanceOf(MatTableDataSource);
      expect(computedDataSource.data.length).toBe(2);
      expect(computedDataSource.data[0].from).toBe('Cuiabá');

      // O spinner deve ser desativado
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e interromper o fluxo caso o id da viagem esteja ausente (Guarda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [TravelRoutesComponent] })
        .overrideComponent(TravelRoutesComponent, {
          set: {
            providers: [
              { provide: TravelService, useValue: travelServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { travel: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(TravelRoutesComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(travelServiceMock.getRoutes).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading graciosamente mesmo se a API falhar', () => {
      travelServiceMock.getRoutes.mockReturnValue(throwError(() => new Error('Erro de API')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['routesList']()).toEqual([]);
    });
  });

  describe('Abertura de Modais de Ação', () => {
    const targetRoute = { id: 1, ticket_id: 88, from: 'Cuiabá', to: 'Rondonópolis', distance: 215.50 } as Route;

    beforeEach(() => {
      fixture.detectChanges(); // Inicializa o estado base dos testes
    });

    it('deve abrir a modal CreateRouteComponent e atualizar a grid se confirmada', () => {
      travelServiceMock.getRoutes.mockClear();

      component['createRoute']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreateRouteComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { travel: mockDialogData.travel }
      });

      expect(travelServiceMock.getRoutes).toHaveBeenCalledWith(88);
    });

    it('deve abrir a modal UpdateRouteComponent passando o registro alvo e atualizar a grid', () => {
      travelServiceMock.getRoutes.mockClear();

      component['updateRoute'](targetRoute);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdateRouteComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { route: targetRoute }
      });

      expect(travelServiceMock.getRoutes).toHaveBeenCalled();
    });

    it('deve abrir a modal DeleteRouteComponent para exclusão e atualizar a grid', () => {
      travelServiceMock.getRoutes.mockClear();

      component['deleteRoute'](targetRoute);

      expect(dialogMock.open).toHaveBeenCalledWith(DeleteRouteComponent, {
        width: '400px',
        disableClose: true,
        autoFocus: false,
        data: { route: targetRoute }
      });

      expect(travelServiceMock.getRoutes).toHaveBeenCalled();
    });

    it('não deve recarregar os dados se as modais forem fechadas sem ação confirmada', () => {
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      travelServiceMock.getRoutes.mockClear();

      component['updateRoute'](targetRoute);

      expect(travelServiceMock.getRoutes).not.toHaveBeenCalled();
    });
  });
});