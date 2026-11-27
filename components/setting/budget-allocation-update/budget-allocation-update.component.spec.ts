// src/app/tfd/components/setting/budget-allocation-update/budget-allocation-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BudgetAllocationUpdateComponent,
  BudgetAllocationUpdateDialogData,
} from './budget-allocation-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { BudgetAllocation } from '../../../models/budget-allocation.model';
import { SettingService } from '../../../services/setting.service';

describe('BudgetAllocationUpdateComponent', () => {
  let component: BudgetAllocationUpdateComponent;
  let fixture: ComponentFixture<BudgetAllocationUpdateComponent>;

  let settingServiceMock: {
    updateBudgetAllocation: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: BudgetAllocationUpdateDialogData | null;

  const baseBudget: BudgetAllocation = {
    id: 7,
    program: 'Programa TFD Estadual',
    active_project: 'Projeto Saúde Itinerante',
    nature_of_expenditure: '339030',
    source: '15001002',
  } as unknown as BudgetAllocation;

  async function createComponent(
    dialogData: BudgetAllocationUpdateDialogData | null = { budget_allocation: { ...baseBudget } }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [BudgetAllocationUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: SettingService, useValue: settingServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(BudgetAllocationUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(BudgetAllocationUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    settingServiceMock = {
      updateBudgetAllocation: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent();
  });

  it('deve criar o componente e preencher o formulário com os dados da alocação orçamentária', () => {
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['budgetAllocationForm'].valid).toBe(true);
    expect(component['budgetAllocationForm'].getRawValue()).toEqual({
      program: 'Programa TFD Estadual',
      active_project: 'Projeto Saúde Itinerante',
      nature_of_expenditure: '339030',
      source: '15001002',
    });
  });

  describe('Inicialização do Formulário', () => {
    it('deve inicializar campos vazios e formulário inválido quando MAT_DIALOG_DATA for null ou sem budget_allocation', async () => {
      await createComponent(null);
      expect(component['budgetAllocationForm'].getRawValue()).toEqual({
        program: '',
        active_project: '',
        nature_of_expenditure: '',
        source: '',
      });
      expect(component['budgetAllocationForm'].invalid).toBe(true);

      await createComponent({});
      expect(component['budgetAllocationForm'].invalid).toBe(true);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('deve exibir mensagem e não chamar updateBudgetAllocation quando budgetId estiver ausente', async () => {
      await createComponent({
        budget_allocation: {
          program: 'Programa TFD Estadual',
          active_project: 'Projeto Saúde Itinerante',
          nature_of_expenditure: '339030',
          source: '15001002',
        } as unknown as BudgetAllocation,
      });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador da alocação orçamentária inválido.'
      );
      expect(settingServiceMock.updateBudgetAllocation).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('não deve enviar a requisição se o formulário estiver inválido e deve marcar campos como tocados', () => {
      component['budgetAllocationForm'].controls.source.setValue('');

      component['onSubmit']();

      expect(settingServiceMock.updateBudgetAllocation).not.toHaveBeenCalled();
      expect(component['budgetAllocationForm'].controls.program.touched).toBe(true);
      expect(component['budgetAllocationForm'].controls.active_project.touched).toBe(true);
      expect(component['budgetAllocationForm'].controls.nature_of_expenditure.touched).toBe(true);
      expect(component['budgetAllocationForm'].controls.source.touched).toBe(true);
    });

    it('não deve enviar nova requisição se já estiver submetendo', () => {
      component['isSubmitting'].set(true);
      fixture.detectChanges();

      component['onSubmit']();

      expect(settingServiceMock.updateBudgetAllocation).not.toHaveBeenCalled();
    });

    it('deve atualizar a alocação com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      component['budgetAllocationForm'].controls.source.setValue('16000000');
      settingServiceMock.updateBudgetAllocation.mockReturnValue(
        of({ message: 'Dotação atualizada!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(settingServiceMock.updateBudgetAllocation).toHaveBeenCalledWith(7, {
        program: 'Programa TFD Estadual',
        active_project: 'Projeto Saúde Itinerante',
        nature_of_expenditure: '339030',
        source: '16000000',
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Dotação atualizada!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['budgetAllocationForm'].enabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      settingServiceMock.updateBudgetAllocation.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Alocação orçamentária atualizada com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve desabilitar o formulário durante requisição pendente e reabilitar ao concluir', () => {
      const pending$ = new Subject<{ message?: string }>();
      settingServiceMock.updateBudgetAllocation.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(true);
      expect(component['budgetAllocationForm'].disabled).toBe(true);

      pending$.next({ message: 'OK' });
      pending$.complete();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['budgetAllocationForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de erro do backend e reverter o estado em caso de falha', () => {
      settingServiceMock.updateBudgetAllocation.mockReturnValue(
        throwError(() => ({ error: { message: 'Fonte orçamentária inválida.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Fonte orçamentária inválida.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['budgetAllocationForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      settingServiceMock.updateBudgetAllocation.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar a alocação orçamentária.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});