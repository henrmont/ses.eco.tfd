import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { InjectionToken } from '@angular/core'; // 👈 Importamos o InjectionToken padrão do Core
import { of, throwError } from 'rxjs';
import { provideNgxMask } from 'ngx-mask';

import { UpdateDailyCostComponent } from './update-daily-cost-component';
import { SettingService } from '../../../services/setting-service';
import { MessageService } from '../../../../core/services/message-service';

// 🛡️ Criamos o token manualmente para o Material ler, evitando imports quebrados do platform-browser
const ANIMATION_MODULE_TYPE = new InjectionToken<string>('AnimationModuleType');

describe('UpdateDailyCostComponent', () => {
  let component: UpdateDailyCostComponent;
  let fixture: ComponentFixture<UpdateDailyCostComponent>;

  let settingServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDailyCost = {
    id: 1,
    name: 'Diária Alimentação',
    value: 120.50
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    settingServiceMock = {
      updateDailyCost: vi.fn().mockReturnValue(of({ message: 'Sucesso ao salvar' }))
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [UpdateDailyCostComponent],
      providers: [
        { provide: SettingService, useValue: settingServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: { daily_cost: mockDailyCost } },
        provideNgxMask(),
        // ⚡ Passamos o nosso token manual dizendo para o Material não rodar animações
        { provide: ANIMATION_MODULE_TYPE, useValue: 'NoopAnimations' }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UpdateDailyCostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  it('should create e carregar o formulário com o valor de data via constructor', () => {
    expect(component).toBeTruthy();
    expect(component.updateDailyCostForm.get('value')?.value).toBe(mockDailyCost.value);
    expect(component.errorMessages['value']).toBeDefined();
  });

  it('deve submeter os dados com sucesso em onSubmit, disparar mensagem e fechar retornando true', () => {
    component.updateDailyCostForm.patchValue({ value: 150.00 });
    
    component.onSubmit();

    expect(settingServiceMock.updateDailyCost).toHaveBeenCalledWith(mockDailyCost.id, { value: 150.00 });
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Sucesso ao salvar');
    expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    expect(component.isSubmitting()).toBe(false);
  });

  it('deve exibir mensagem tratada do servidor se a API falhar no onSubmit', () => {
    const errorResponse = { error: { message: 'Erro interno de validação' } };
    settingServiceMock.updateDailyCost.mockReturnValue(throwError(() => errorResponse));

    component.onSubmit();

    expect(settingServiceMock.updateDailyCost).toHaveBeenCalled();
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro interno de validação');
    expect(dialogRefMock.close).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });

  it('NÃO deve processar o envio se o formulário estiver com valor inválido', () => {
    component.updateDailyCostForm.patchValue({ value: 0 });
    
    component.onSubmit();

    expect(settingServiceMock.updateDailyCost).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });
});