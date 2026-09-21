import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { describe, it, expect, beforeEach } from 'vitest';

import { ShowAccountabilityComponent } from './show-accountability-component';

describe('ShowAccountabilityComponent', () => {
  let component: ShowAccountabilityComponent;
  let fixture: ComponentFixture<ShowAccountabilityComponent>;

  // Massa de dados mock simulando os dados injetados na modal de Prestação de Contas
  const mockDialogData = {
    accountability: {
      id: 120,
      name: 'Prestação de Contas de Deslocamento TFD',
      created_at: '2026-07-02T00:00:00.000Z',
      total_dailies: 450.00,
      accountability_dailies: [
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
      imports: [ShowAccountabilityComponent]
    })
    // 🚀 Isolando os providers diretamente no escopo do componente com OnPush
    .overrideComponent(ShowAccountabilityComponent, {
      set: {
        providers: [
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShowAccountabilityComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização e Mapeamento de Dados', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve injetar e expor os dados da prestação de contas corretamente via MAT_DIALOG_DATA', () => {
      fixture.detectChanges();
      
      expect(component['data']).toBeDefined();
      expect(component['data']?.accountability?.id).toBe(120);
      expect(component['data']?.accountability?.name).toBe('Prestação de Contas de Deslocamento TFD');
      expect(component['data']?.accountability?.accountability_dailies.length).toBe(1);
    });
  });

  describe('Comportamento Defensivo do Template (Safe Navigation)', () => {
    it('deve inicializar sem quebrar a renderização caso o objeto accountability venha nulo ou indefinido', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ShowAccountabilityComponent] })
        .overrideComponent(ShowAccountabilityComponent, {
          set: {
            providers: [
              { provide: MAT_DIALOG_DATA, useValue: { accountability: null } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(ShowAccountabilityComponent);
      const localComponent = localFixture.componentInstance;
      
      expect(() => localFixture.detectChanges()).not.toThrow();
      expect(localComponent['data']?.accountability).toBeNull();
    });

    it('deve renderizar a linha vazia (@empty) no template quando não houver diárias vinculadas', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ShowAccountabilityComponent] })
        .overrideComponent(ShowAccountabilityComponent, {
          set: {
            providers: [
              { 
                provide: MAT_DIALOG_DATA, 
                useValue: { 
                  accountability: { 
                    ...mockDialogData.accountability, 
                    accountability_dailies: [] 
                  } 
                } 
              }
            ]
          }
        });

      const localFixture = TestBed.createComponent(ShowAccountabilityComponent);
      localFixture.detectChanges();
      
      const compiled = localFixture.nativeElement as HTMLElement;
      const emptyRow = compiled.querySelector('.empty-row');
      
      expect(emptyRow).toBeTruthy();
      expect(emptyRow?.textContent?.trim()).toBe('Nenhuma diária vinculada à prestação de contas.');
    });
  });
});