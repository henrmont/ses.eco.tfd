import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreateAccountabilityComponent } from './create-accountability-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { MessageService } from '../../../../core/services/message-service';

describe('CreateAccountabilityComponent', () => {
  let component: CreateAccountabilityComponent;
  let fixture: ComponentFixture<CreateAccountabilityComponent>;

  let accountabilityServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    patient_request: {
      id: 550,
      description: 'Solicitação de teste para Prestação de Contas'
    }
  };

  beforeEach(async () => {
    accountabilityServiceMock = {
      createAccountability: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        CreateAccountabilityComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: AccountabilityService, useValue: accountabilityServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(CreateAccountabilityComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateAccountabilityComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário com os campos padrões vazios', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['createAccountabilityForm']).toBeTruthy();
    
    expect(component['createAccountabilityForm'].get('name')?.value).toBeNull();
  });

  describe('Fluxo de Submissão do Formulário de Prestação de Contas (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante que o objeto data seja resetado para o estado íntegro original antes de cada teste
      (component as any).data = {
        patient_request: {
          id: 550,
          description: 'Solicitação de teste para Prestação de Contas'
        }
      };
    });

    it('deve ignorar chamadas subsequentes ao onSubmit se isSubmitting já for verdadeiro (proteção contra duplo clique)', () => {
      component['createAccountabilityForm'].patchValue({
        name: 'Prestação Concorrente'
      });

      // Força o estado de submissão ativo
      component['isSubmitting'].set(true);

      component['onSubmit']();

      // Garante que o serviço NÃO foi chamado porque a proteção de gatekeeper barrou o fluxo
      expect(accountabilityServiceMock.createAccountability).not.toHaveBeenCalled();
    });

    it('deve barrar a submissão e marcar campos como tocados se o formulário estiver inválido (campos requeridos em branco)', () => {
      expect(component['createAccountabilityForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(accountabilityServiceMock.createAccountability).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se o ID da solicitação do paciente não existir nos dados da modal', () => {
      // Modifica o estado do dado local com segurança para simular falha na checagem
      (component as any).data = { patient_request: null };
      component['createAccountabilityForm'].patchValue({ name: 'Prestação de Contas - Abril' });
      
      component['onSubmit']();

      expect(accountabilityServiceMock.createAccountability).not.toHaveBeenCalled();
    });

    it('deve criar a prestação de contas com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['createAccountabilityForm'].patchValue({
        name: 'Prestação de Contas - Março'
      });

      accountabilityServiceMock.createAccountability.mockReturnValue(of({ message: 'Prestação de contas incluída com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(accountabilityServiceMock.createAccountability).toHaveBeenCalledWith(550, {
        name: 'Prestação de Contas - Março'
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Prestação de contas incluída com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API do servidor se o backend falhar', () => {
      component['createAccountabilityForm'].patchValue({
        name: 'Prestação Inválida'
      });

      const mockApiError = { error: { message: 'Esta prestação de contas já foi cadastrada para esta solicitação.' } };
      accountabilityServiceMock.createAccountability.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Esta prestação de contas já foi cadastrada para esta solicitação.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      component['createAccountabilityForm'].patchValue({
        name: 'Prestação com Erro Crítico'
      });

      const mockRawError = { status: 500, statusText: 'Internal Server Error' };
      accountabilityServiceMock.createAccountability.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao criar a prestação de contas.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});