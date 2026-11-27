// src/app/tfd/components/setting/daily-cost-update/daily-cost-update.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DailyCostUpdateComponent,
  DailyCostUpdateDialogData,
} from './daily-cost-update.component';
import { MessageService } from '../../../../core/services/message.service';
import { DailyCost } from '../../../models/daily-cost.model';
import { SettingService } from '../../../services/setting.service';

describe('DailyCostUpdateComponent', () => {
  let component: DailyCostUpdateComponent;
  let fixture: ComponentFixture<DailyCostUpdateComponent>;

  let settingServiceMock: {
    updateDailyCost: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogRefMock: {
    close: ReturnType<typeof vi.fn>;
  };
  let mockDialogData: DailyCostUpdateDialogData | null;

  const baseDailyCost: DailyCost = {
    id: 4,
    name: 'Alimentação',
    value: 85,
  } as unknown as DailyCost;

  async function createComponent(
    dialogData: DailyCostUpdateDialogData | null = { daily_cost: { ...baseDailyCost } }
  ): Promise<void> {
    mockDialogData = dialogData;

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [DailyCostUpdateComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: SettingService, useValue: settingServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData },
        ],
      })
      .overrideComponent(DailyCostUpdateComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(DailyCostUpdateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    settingServiceMock = {
      updateDailyCost: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    dialogRefMock = {
      close: vi.fn(),
    };

    await createComponent();
  });

  it('deve criar o componente, preencher o formulário e expor dailyCostName', () => {
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['dailyCostName']).toBe('Alimentação');
    expect(component['dailyCostForm'].valid).toBe(true);
    expect(component['dailyCostForm'].controls.value.value).toBe(85);
  });

  describe('Getter dailyCostName e Inicialização', () => {
    it('deve retornar "Diária" quando daily_cost ou name estiver ausente e inicializar value vazio', async () => {
      await createComponent(null);
      expect(component['dailyCostName']).toBe('Diária');
      expect(component['dailyCostForm'].controls.value.value).toBe('');
      expect(component['dailyCostForm'].invalid).toBe(true);

      await createComponent({ daily_cost: { id: 4, value: 50 } as unknown as DailyCost });
      expect(component['dailyCostName']).toBe('Diária');
      expect(component['dailyCostForm'].controls.value.value).toBe(50);
    });

    it('deve invalidar o campo value quando for menor que 0.01', () => {
      component['dailyCostForm'].controls.value.setValue(0);
      expect(component['dailyCostForm'].controls.value.hasError('min')).toBe(true);
      expect(component['dailyCostForm'].invalid).toBe(true);
    });
  });

  describe('Submissão do Formulário (onSubmit)', () => {
    it('deve exibir mensagem e não chamar updateDailyCost quando dailyCostId estiver ausente', async () => {
      await createComponent({
        daily_cost: { name: 'Pousada', value: 120 } as unknown as DailyCost,
      });

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Identificador do custo de diária inválido.'
      );
      expect(settingServiceMock.updateDailyCost).not.toHaveBeenCalled();
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('não deve enviar a requisição se o formulário estiver inválido e deve marcar campos como tocados', () => {
      component['dailyCostForm'].controls.value.setValue('');

      component['onSubmit']();

      expect(settingServiceMock.updateDailyCost).not.toHaveBeenCalled();
      expect(component['dailyCostForm'].controls.value.touched).toBe(true);
    });

    it('não deve enviar nova requisição se já estiver submetendo', () => {
      component['isSubmitting'].set(true);
      fixture.detectChanges();

      component['onSubmit']();

      expect(settingServiceMock.updateDailyCost).not.toHaveBeenCalled();
    });

    it('deve atualizar o custo da diária com sucesso, exibir mensagem da resposta e fechar o dialog com true', () => {
      component['dailyCostForm'].controls.value.setValue(95);
      settingServiceMock.updateDailyCost.mockReturnValue(
        of({ message: 'Valor da diária atualizado!' })
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(settingServiceMock.updateDailyCost).toHaveBeenCalledWith(4, {
        value: 95,
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Valor da diária atualizado!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      expect(component['isSubmitting']()).toBe(false);
      expect(component['dailyCostForm'].enabled).toBe(true);
    });

    it('deve usar mensagem padrão de sucesso quando a resposta não trouxer message', () => {
      settingServiceMock.updateDailyCost.mockReturnValue(of({}));

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Custo de diária atualizado com sucesso!'
      );
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve desabilitar o formulário durante requisição pendente e reabilitar ao concluir', () => {
      const pending$ = new Subject<{ message?: string }>();
      settingServiceMock.updateDailyCost.mockReturnValue(pending$.asObservable());

      component['onSubmit']();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(true);
      expect(component['dailyCostForm'].disabled).toBe(true);

      pending$.next({ message: 'OK' });
      pending$.complete();
      fixture.detectChanges();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['dailyCostForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de erro do backend e reverter o estado em caso de falha', () => {
      settingServiceMock.updateDailyCost.mockReturnValue(
        throwError(() => ({ error: { message: 'Valor fora do limite permitido.' } }))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Valor fora do limite permitido.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['dailyCostForm'].enabled).toBe(true);
    });

    it('deve exibir mensagem de fallback quando o erro não possuir message explícita', () => {
      settingServiceMock.updateDailyCost.mockReturnValue(
        throwError(() => new Error('Falha de rede'))
      );

      component['onSubmit']();
      fixture.detectChanges();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao atualizar o custo da diária.'
      );
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});