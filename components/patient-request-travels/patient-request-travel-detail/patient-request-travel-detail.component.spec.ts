import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideEnvironmentNgxMask } from 'ngx-mask'; // 🚀 Importação crucial para resolver a DI da máscara
import { describe, it, expect, beforeEach } from 'vitest';

import { ShowTravelComponent } from './show-travel-component';

describe('ShowTravelComponent', () => {
  let component: ShowTravelComponent;
  let fixture: ComponentFixture<ShowTravelComponent>;

  const mockDialogData = {
    travel: {
      id: 42,
      transportation: 'Ônibus Leito',
      os: 'OS-2026-99',
      origin: 'Cuiabá',
      destination: 'São Paulo',
      departure_date: '2026-07-10T08:00:00Z',
      return_date: '2026-07-20T18:00:00Z',
      description: 'Viagem agendada para tratamento especializado.',
      passengers: [
        {
          id: 1,
          is_patient: true,
          patient: {
            name: 'Carlos Silva',
            document: '11122233344'
          }
        },
        {
          id: 2,
          is_patient: false,
          escort: {
            name: 'Maria Silva',
            document: '55566677788'
          }
        }
      ]
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowTravelComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        provideEnvironmentNgxMask() // 🛠️ Resolve o InjectionToken ngx-mask config injetando o comportamento padrão
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowTravelComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização e Renderização', () => {
    it('deve criar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve expor corretamente os dados da viagem injetados pelo diálogo', () => {
      fixture.detectChanges();
      expect(component['data']).toBeDefined();
      expect(component['data'].travel.id).toBe(42);
      expect(component['data'].travel.destination).toBe('São Paulo');
      expect(component['data'].travel.passengers.length).toBe(2);
    });
  });

  describe('Validações de Fallbacks e Casos de Borda', () => {
    it('deve renderizar a modal normalmente mesmo se dados opcionais vierem nulos ou ausentes', () => {
      TestBed.resetTestingModule();
      
      const mockDadosIncompletos = {
        travel: {
          id: 43,
          transportation: 'Van',
          os: null,
          origin: undefined,
          destination: 'Rondonópolis',
          passengers: []
        }
      };

      TestBed.configureTestingModule({
        imports: [ShowTravelComponent],
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: mockDadosIncompletos },
          provideEnvironmentNgxMask() // Re-injetado no escopo local do teste marginal
        ]
      });

      const localFixture = TestBed.createComponent(ShowTravelComponent);
      const localComponent = localFixture.componentInstance;
      
      expect(() => {
        localFixture.detectChanges();
      }).not.toThrow();

      expect(localComponent['data'].travel.os).toBeNull();
      expect(localComponent['data'].travel.passengers.length).toBe(0);
    });
  });
});