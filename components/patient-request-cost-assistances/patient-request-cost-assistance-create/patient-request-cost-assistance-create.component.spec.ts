import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreateCostAssistanceComponent } from './create-cost-assistance-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreateCostAssistanceComponent', () => {
  let component: CreateCostAssistanceComponent;
  let fixture: ComponentFixture<CreateCostAssistanceComponent>;

  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 550,
      description: 'Solicitação de teste para Ajuda de Custo'
    }
  };

  beforeEach(async () => {
    costAssistanceServiceMock = {
      createCostAssistance: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateCostAssistanceComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreateCostAssistanceComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateCostAssistanceComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário com os campos padrões vazios', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['createCostAssistanceForm']).toBeTruthy();
    
    expect(component['createCostAssistanceForm'].get('name')?.value).toBeNull();
    expect(component['createCostAssistanceForm'].get('type')?.value).toBeNull();
  });

  describe('Fluxo de Submissão do Formulário de Ajuda de Custo (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante que o objeto data seja resetado para o estado íntegro original antes de cada teste
      (component as any).data = {
        patient_request: {
          id: 550,
          description: 'Solicitação de teste para Ajuda de Custo'
        }
      };
    });

    it('deve barrar a submissão e marcar campos como tocados se o formulário estiver inválido (campos requeridos em branco)', () => {
      expect(component['createCostAssistanceForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(costAssistanceServiceMock.createCostAssistance).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se o ID da solicitação do paciente não existir nos dados da modal', () => {
      // Modifica o estado do dado local com segurança para simular falha na checagem
      (component as any).data = { patient_request: null };
      component['createCostAssistanceForm'].patchValue({ name: 'Auxílio Alimentação', type: 'Alimentação' });
      
      component['onSubmit']();

      expect(costAssistanceServiceMock.createCostAssistance).not.toHaveBeenCalled();
    });

    it('deve criar a ajuda de custo com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['createCostAssistanceForm'].patchValue({
        name: 'Auxílio Transporte Urbano',
        type: 'Transporte'
      });

      costAssistanceServiceMock.createCostAssistance.mockReturnValue(of({ message: 'Ajuda de custo incluída com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(costAssistanceServiceMock.createCostAssistance).toHaveBeenCalledWith(550, {
        name: 'Auxílio Transporte Urbano',
        type: 'Transporte'
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ajuda de custo incluída com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API do servidor se o backend falhar', () => {
      component['createCostAssistanceForm'].patchValue({
        name: 'Auxílio Inválido',
        type: 'Outros'
      });

      const mockApiError = { error: { message: 'Este tipo de ajuda de custo já foi cadastrado para esta solicitação.' } };
      costAssistanceServiceMock.createCostAssistance.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Este tipo de ajuda de custo já foi cadastrado para esta solicitação.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      component['createCostAssistanceForm'].patchValue({
        name: 'Auxílio Hospedagem',
        type: 'Hospedagem'
      });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      costAssistanceServiceMock.createCostAssistance.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao criar a ajuda de custo.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});