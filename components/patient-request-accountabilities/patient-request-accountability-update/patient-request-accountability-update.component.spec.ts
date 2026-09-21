import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { UpdateAccountabilityComponent } from './update-accountability-component';
import { AccountabilityService } from '../../../services/accountability-service';
import { MessageService } from '../../../../core/services/message-service';

describe('UpdateAccountabilityComponent', () => {
  let component: UpdateAccountabilityComponent;
  let fixture: ComponentFixture<UpdateAccountabilityComponent>;

  let accountabilityServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    accountability: {
      id: 123,
      name: 'Prestação de Contas Viagem Antiga'
    }
  };

  beforeEach(async () => {
    accountabilityServiceMock = {
      updateAccountability: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [
        UpdateAccountabilityComponent
      ],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: AccountabilityService, useValue: accountabilityServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(UpdateAccountabilityComponent, {
      set: {
        providers: [
          { provide: MatDialogRef, useValue: dialogRefMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateAccountabilityComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso e inicializar o formulário carregando os dados pré-existentes', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
    expect(component['updateAccountabilityForm']).toBeTruthy();
    
    // O formulário deve iniciar preenchido com os dados recebidos via injeção
    expect(component['updateAccountabilityForm'].get('name')?.value).toBe('Prestação de Contas Viagem Antiga');
  });

  describe('Fluxo de Submissão do Formulário de Prestação de Contas (onSubmit)', () => {
    beforeEach(() => {
      fixture.detectChanges();
      
      // 🛡️ Garante o estado íntegro original dos dados injetados antes de cada teste
      (component as any).data = {
        accountability: {
          id: 123,
          name: 'Prestação de Contas Viagem Antiga'
        }
      };
    });

    it('deve barrar a submissão e marcar campos como tocados se o formulário estiver inválido (nome limpo ou vazio)', () => {
      component['updateAccountabilityForm'].patchValue({ name: null });
      expect(component['updateAccountabilityForm'].invalid).toBe(true);

      component['onSubmit']();

      expect(accountabilityServiceMock.updateAccountability).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve barrar a submissão se o ID do registro de prestação de contas não existir nos dados da modal', () => {
      // Modifica o estado do dado injetado local simulando inconsistência
      (component as any).data = { accountability: null };
      
      component['onSubmit']();

      expect(accountabilityServiceMock.updateAccountability).not.toHaveBeenCalled();
    });

    it('deve atualizar a prestação de contas com sucesso utilizando getRawValue, exibir mensagem e fechar a modal', () => {
      component['updateAccountabilityForm'].patchValue({
        name: 'Prestação de Contas Viagem Atualizada'
      });

      accountabilityServiceMock.updateAccountability.mockReturnValue(of({ message: 'Prestação de contas atualizada com sucesso!' }));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(false);
      expect(accountabilityServiceMock.updateAccountability).toHaveBeenCalledWith(123, {
        name: 'Prestação de Contas Viagem Atualizada'
      });
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Prestação de contas atualizada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar e expor erros amigáveis retornados pela API do servidor se o backend falhar', () => {
      component['updateAccountabilityForm'].patchValue({
        name: 'Nome Conflitante'
      });

      const mockApiError = { error: { message: 'Já existe uma prestação de contas ativa com este nome.' } };
      accountabilityServiceMock.updateAccountability.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Já existe uma prestação de contas ativa com este nome.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve acionar a string de fallback padrão quando o servidor retornar um erro genérico sem mensagem explícita', () => {
      const mockRawError = { status: 400, statusText: 'Bad Request' };
      accountabilityServiceMock.updateAccountability.mockReturnValue(throwError(() => mockRawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao atualizar a prestação de contas.');
      expect(dialogRefMock.close).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve usar a string de fallback quando err.error existe mas nao possui message', () => {
      const mockPartialError = { error: {} }; // err existe, err.error existe, message é undefined
      accountabilityServiceMock.updateAccountability.mockReturnValue(throwError(() => mockPartialError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao atualizar a prestação de contas.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});