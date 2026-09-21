import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HaltedPatientRequestComponent } from './halted-patient-request-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('HaltedPatientRequestComponent (Opinions)', () => {
  let component: HaltedPatientRequestComponent;
  let fixture: ComponentFixture<HaltedPatientRequestComponent>;
  
  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  // Mock inicial simulando o perfil médico e uma solicitação com bookmark inativo
  const mockDialogData = {
    type: 'medical',
    patient_request: {
      id: 450,
      is_medical_bookmark: false,
      is_social_bookmark: false,
      name: 'Carlos Alberto'
    }
  };

  beforeEach(async () => {
    opinionServiceMock = {
      haltedPatientRequest: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [HaltedPatientRequestComponent]
    })
    .overrideComponent(HaltedPatientRequestComponent, {
      set: {
        providers: [
          { provide: OpinionService, useValue: opinionServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(HaltedPatientRequestComponent);
    component = fixture.componentInstance;
  });

  describe('Inicialização', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });

    it('deve inicializar com o estado de submissão desativado', () => {
      fixture.detectChanges();
      expect(component['isSubmitting']()).toBe(false);
    });
  });

  describe('Fluxo de Submissão (onSubmit)', () => {
    it('deve barrar a execução e exibir mensagem de erro se o id da solicitação não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [HaltedPatientRequestComponent] })
        .overrideComponent(HaltedPatientRequestComponent, {
          set: {
            providers: [
              { provide: OpinionService, useValue: opinionServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { type: 'medical', patient_request: { id: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(HaltedPatientRequestComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador da solicitação não encontrado.');
      expect(opinionServiceMock.haltedPatientRequest).not.toHaveBeenCalled();
    });

    // =============================================================
    // 🎯 FLUXO A: PERFIL MÉDICO (medical)
    // =============================================================
    describe('Quando o perfil logado for Médico (type: medical)', () => {
      it('deve atualizar o sobrestamento com sucesso repassando o tipo e o id', () => {
        fixture.detectChanges();
        const mockApiResponse = { message: 'Sobrestamento médico modificado!' };
        opinionServiceMock.haltedPatientRequest.mockReturnValue(of(mockApiResponse));

        component['onSubmit']();

        expect(component['isSubmitting']()).toBe(false);
        expect(opinionServiceMock.haltedPatientRequest).toHaveBeenCalledWith('medical', 450);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Sobrestamento médico modificado!');
        expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      });

      it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
        fixture.detectChanges();
        opinionServiceMock.haltedPatientRequest.mockReturnValue(of({}));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Status de sobrestamento atualizado!');
      });

      it('deve tratar falhas do servidor, exibir mensagem de erro da API e liberar o estado de submissão', () => {
        fixture.detectChanges();
        const mockApiError = { error: { message: 'Erro controlado de validação médica da API.' } };
        opinionServiceMock.haltedPatientRequest.mockReturnValue(throwError(() => mockApiError));

        component['onSubmit']();

        expect(opinionServiceMock.haltedPatientRequest).toHaveBeenCalledWith('medical', 450);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
        expect(component['isSubmitting']()).toBe(false);
        expect(dialogRefMock.close).not.toHaveBeenCalled();
      });

      it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
        fixture.detectChanges();
        const rawError = { status: 500 };
        opinionServiceMock.haltedPatientRequest.mockReturnValue(throwError(() => rawError));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro operacional ao atualizar o sobrestamento.');
        expect(component['isSubmitting']()).toBe(false);
      });
    });

    // =============================================================
    // 🎯 FLUXO B: PERFIL SOCIAL (social)
    // =============================================================
    describe('Quando o perfil logado for Assistente Social (type: social)', () => {
      beforeEach(() => {
        Object.assign(component['data'], { type: 'social' });
        Object.assign(component['data'].patient_request, { is_social_bookmark: true });
      });

      it('deve executar a chamada de API passando o tipo social e o ID normalmente', () => {
        fixture.detectChanges();
        opinionServiceMock.haltedPatientRequest.mockReturnValue(of({ message: 'Modificado fluxo social.' }));

        component['onSubmit']();

        expect(opinionServiceMock.haltedPatientRequest).toHaveBeenCalledWith('social', 450);
        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Modificado fluxo social.');
        expect(dialogRefMock.close).toHaveBeenCalledWith(true);
      });

      it('deve resetar o sinal isSubmitting caso ocorra erro no fluxo da assistente social', () => {
        fixture.detectChanges();
        opinionServiceMock.haltedPatientRequest.mockReturnValue(throwError(() => ({ status: 404 })));

        component['onSubmit']();

        expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro operacional ao atualizar o sobrestamento.');
        expect(component['isSubmitting']()).toBe(false);
      });
    });
  });
});