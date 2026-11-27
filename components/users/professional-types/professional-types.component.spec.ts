// src/app/tfd/components/users/professional-types/professional-types.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfessionalTypesComponent } from './professional-types.component';
import { Professionals } from '../../../enums/professionals';

type ProfessionalTypesDialogData = {
  selectedTypes?: string[];
};

describe('ProfessionalTypesComponent', () => {
  let component: ProfessionalTypesComponent;
  let fixture: ComponentFixture<ProfessionalTypesComponent>;

  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };

  const allProfessionals = Object.values(Professionals);
  const firstType = allProfessionals[0] ?? 'MEDICO';
  const secondType = allProfessionals[1] ?? 'ASSISTENTE_SOCIAL';

  async function createComponent(
    dialogData: ProfessionalTypesDialogData | null
  ): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [ProfessionalTypesComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(ProfessionalTypesComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ProfessionalTypesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent({ selectedTypes: [firstType] });
  });

  it('deve criar o componente, carregar professionalTypes e inicializar com os tipos recebidos', () => {
    expect(component).toBeTruthy();
    expect(component['professionalTypes']()).toEqual(allProfessionals);
    expect(component['selectedTypes']).toEqual([firstType]);
    expect(component['checkType'](firstType)).toBe(true);
    expect(component['checkType'](secondType)).toBe(false);
  });

  describe('Inicialização do Formulário', () => {
    it('deve inicializar selectedTypes como array vazio quando MAT_DIALOG_DATA for null ou sem selectedTypes', async () => {
      await createComponent(null);
      expect(component['selectedTypes']).toEqual([]);

      await createComponent({});
      expect(component['selectedTypes']).toEqual([]);
    });

    it('deve retornar array vazio em selectedTypes quando o controle types não for um array', () => {
      component['typesForm'].get('types')?.setValue(null);
      expect(component['selectedTypes']).toEqual([]);
    });
  });

  describe('Alternância de Tipos (toggleType e checkType)', () => {
    it('deve adicionar e remover tipos marcando o formulário como dirty', () => {
      component['toggleType'](secondType);
      fixture.detectChanges();

      expect(component['typesForm'].dirty).toBe(true);
      expect(component['selectedTypes']).toEqual([firstType, secondType]);
      expect(component['checkType'](secondType)).toBe(true);

      component['toggleType'](firstType);
      fixture.detectChanges();

      expect(component['selectedTypes']).toEqual([secondType]);
      expect(component['checkType'](firstType)).toBe(false);
    });

    it('deve retornar silenciosamente se o controle types não existir', () => {
      const getSpy = vi.spyOn(component['typesForm'], 'get').mockReturnValue(null);

      expect(() => component['toggleType'](secondType)).not.toThrow();

      getSpy.mockRestore();
      expect(component['selectedTypes']).toEqual([firstType]);
    });
  });

  describe('Confirmação (onConfirm)', () => {
    it('deve fechar o dialog passando os tipos selecionados quando o formulário for válido', () => {
      component['toggleType'](secondType);

      component['onConfirm']();

      expect(dialogRefMock.close).toHaveBeenCalledWith([firstType, secondType]);
    });

    it('não deve fechar o dialog quando o formulário estiver inválido', () => {
      component['typesForm'].setErrors({ invalid: true });

      component['onConfirm']();

      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });
  });
});