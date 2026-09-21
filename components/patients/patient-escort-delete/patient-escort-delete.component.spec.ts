import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeletePatientEscortComponent } from './delete-patient-escort-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeletePatientEscortComponent', () => {
  let component: DeletePatientEscortComponent;
  let fixture: ComponentFixture<DeletePatientEscortComponent>;
  
  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    escort: {
      id: 12,
      name: 'Juvenal Antunes',
      pivot: {
        id: 99
      }
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      deletePatientEscort: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeletePatientEscortComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente
    .overrideComponent(DeletePatientEscortComponent, {
      set: {
        providers: [
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MatDialogRef, useValue: dialogRefMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeletePatientEscortComponent);
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
    it('deve barrar a execução e exibir mensagem de erro se o pivot id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeletePatientEscortComponent] })
        .overrideComponent(DeletePatientEscortComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { escort: { name: 'Incompleto', pivot: null } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeletePatientEscortComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do vínculo não encontrado.');
      expect(patientServiceMock.deletePatientEscort).not.toHaveBeenCalled();
    });

    it('deve remover o acompanhante com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Vínculo removido com sucesso!' };
      patientServiceMock.deletePatientEscort.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.deletePatientEscort).toHaveBeenCalledWith(99);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Vínculo removido com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    // 🎯 NOVO: Cobre o branch do fallback de sucesso sem mensagem da API
    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      patientServiceMock.deletePatientEscort.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Acompanhante removido com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover este acompanhante.' } };
      patientServiceMock.deletePatientEscort.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(patientServiceMock.deletePatientEscort).toHaveBeenCalledWith(99);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    // 🎯 NOVO: Cobre o branch do fallback de erro genérico se a API falhar sem payload estruturado
    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      patientServiceMock.deletePatientEscort.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover o acompanhante.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});