import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { describe, it, expect, beforeEach } from 'vitest';

import { ShowCostAssistanceComponent } from './show-cost-assistance-component';

describe('ShowCostAssistanceComponent', () => {
  let component: ShowCostAssistanceComponent;
  let fixture: ComponentFixture<ShowCostAssistanceComponent>;

  // Massa de dados fake simulando os dados injetados na modal
  const mockDialogData = {
    cost_assistance: {
      id: 120,
      name: 'Ajuda de Custo para Tratamento fora do Domicílio',
      type: 'TFD',
      created_at: '2026-07-02T00:00:00.000Z',
      total_dailies: 450.00,
      cost_assistance_dailies: [
        {
          id: 1,
          amount: 3,
          daily_cost: {
            name: 'Diária Alimentação Completa',
            value: 150.00
          }
        }
      ]
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowCostAssistanceComponent]
    })
    // 🚀 Isolando os providers diretamente no escopo do componente com OnPush
    .overrideComponent(ShowCostAssistanceComponent, {
      set: {
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowCostAssistanceComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização e Mapeamento de Dados', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve injetar e expor os dados da ajuda de custo corretamente via MAT_DIALOG_DATA', () => {
      fixture.detectChanges();
      
      expect(component['data']).toBeDefined();
      expect(component['data']?.cost_assistance?.id).toBe(120);
      expect(component['data']?.cost_assistance?.name).toBe('Ajuda de Custo para Tratamento fora do Domicílio');
      expect(component['data']?.cost_assistance?.cost_assistance_dailies.length).toBe(1);
    });
  });

  describe('Comportamento Defensivo do Template (Safe Navigation)', () => {
    it('deve inicializar sem quebrar a renderização caso o objeto cost_assistance venha nulo ou indefinido', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ShowCostAssistanceComponent] })
        .overrideComponent(ShowCostAssistanceComponent, {
          set: {
            providers: [
              { provide: MAT_DIALOG_DATA, useValue: { cost_assistance: null } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(ShowCostAssistanceComponent);
      const localComponent = localFixture.componentInstance;
      
      expect(() => localFixture.detectChanges()).not.toThrow();
      expect(localComponent['data']?.cost_assistance).toBeNull();
    });

    it('deve renderizar a linha vazia (@empty) no template quando não houver diárias vinculadas', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ShowCostAssistanceComponent] })
        .overrideComponent(ShowCostAssistanceComponent, {
          set: {
            providers: [
              { 
                provide: MAT_DIALOG_DATA, 
                useValue: { 
                  cost_assistance: { 
                    ...mockDialogData.cost_assistance, 
                    cost_assistance_dailies: [] 
                  } 
                } 
              }
            ]
          }
        });

      const localFixture = TestBed.createComponent(ShowCostAssistanceComponent);
      localFixture.detectChanges();
      
      const compiled = localFixture.nativeElement as HTMLElement;
      const emptyRow = compiled.querySelector('.empty-row');
      
      expect(emptyRow).toBeTruthy();
      expect(emptyRow?.textContent?.trim()).toBe('Nenhuma diária vinculada à ajuda de custo.');
    });
  });
});