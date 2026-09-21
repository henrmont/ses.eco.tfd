import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UpdateCostAssistanceComponent } from './update-cost-assistance-component';
import { CostAssistanceService } from '../../../services/cost-assistance-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateCostAssistanceComponent', () => {
  let component: UpdateCostAssistanceComponent;
  let fixture: ComponentFixture<UpdateCostAssistanceComponent>;

  let costAssistanceServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    cost_assistance: {
      id: 123,
      name: 'Ajuda de Custo Alimentação Antiga',
      type: 'Alimentação'
    }
  };

  beforeEach(async () => {
    costAssistanceServiceMock = {
      updateCostAssistance: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateCostAssistanceComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: CostAssistanceService, useValue: costAssistanceServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdateCostAssistanceComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateCostAssistanceComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário carregando os dados pré-existentes', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['updateCostAssistanceForm']).toBeTruthy();
    
    // Diferente do "create", aqui o formulário deve iniciar preenchido com os dados recebidos via injeção
    expect(component['updateCostAssistanceForm'].get('name')?.value).toBe('Ajuda de Custo Alimentação Antiga');
    expect(component['updateCostAssistanceForm'].get('type')?.value).toBe('Alimentação');
  });

  describe('Fluxo de Submissão do Formulário de Ajuda de Custo (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante o estado íntegro original dos dados injetados antes de cada teste
      (component as any).data = {
        cost_assistance: {
          id: 123,
          name: 'Ajuda de Custo Alimentação Antiga',
          type: 'Alimentação'
        }
      };
    });

    it('deve barrar a submissão e marcar campos como tocados se o formulário estiver inválido (nome limpo ou vazio)', () => {
      component['updateCostAssistanceForm'].patchValue({ name: null });
      expect(component['updateCostAssistanceForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(costAssistanceServiceMock.updateCostAssistance).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se o ID do registro de ajuda de custo não existir nos dados da modal', () => {
      // Modifica o estado do dado injetado local simulando inconsistência
      (component as any).data = { cost_assistance: null };
      
      component['onSubmit']();

      expect(costAssistanceServiceMock.updateCostAssistance).not.toHaveBeenCalled();
    });

    it('deve atualizar a ajuda de custo com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['updateCostAssistanceForm'].patchValue({
        name: 'Ajuda de Custo Hotelaria Atualizada',
        type: 'Hospedagem'
      });

      costAssistanceServiceMock.updateCostAssistance.mockReturnValue(of({ message: 'Ajuda de custo atualizada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(costAssistanceServiceMock.updateCostAssistance).toHaveBeenCalledWith(123, {
        name: 'Ajuda de Custo Hotelaria Atualizada',
        type: 'Hospedagem'
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ajuda de custo atualizada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API do servidor se o backend falhar', () => {
      component['updateCostAssistanceForm'].patchValue({
        name: 'Nome Conflitante'
      });

      const mockApiError = { error: { message: 'Já existe uma ajuda de custo ativa com este nome.' } };
      costAssistanceServiceMock.updateCostAssistance.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Já existe uma ajuda de custo ativa com este nome.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      const mockRawError = { status: 400, statusText: 'Bad Request' };
      costAssistanceServiceMock.updateCostAssistance.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao atualizar a ajuda de custo.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});