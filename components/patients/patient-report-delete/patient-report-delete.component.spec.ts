import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DeletePatientReportComponent } from './delete-patient-report-component';
import { PatientService } from '../../../services/patient-service';
import { MessageService } from '../../../../core/services/message-service';

describe('DeletePatientReportComponent', () => {
  let component: DeletePatientReportComponent;
  let fixture: ComponentFixture<DeletePatientReportComponent>;
  
  let patientServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;

  const mockDialogData = {
    report: {
      id: 150,
      protocol: '2026.06.008X'
    }
  };

  beforeEach(async () => {
    patientServiceMock = {
      deletePatientReport: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [DeletePatientReportComponent]
    })
    // 🚀 Usando o recurso de override para forçar os providers direto no escopo do componente
    .overrideComponent(DeletePatientReportComponent, {
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

    fixture = TestBed.createComponent(DeletePatientReportComponent);
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
    it('deve barrar a execução e exibir mensagem de erro se o report id não estiver presente', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [DeletePatientReportComponent] })
        .overrideComponent(DeletePatientReportComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: MessageService, useValue: messageServiceMock },
              { provide: MatDialogRef, useValue: dialogRefMock },
              { provide: MAT_DIALOG_DATA, useValue: { report: { protocol: 'Incompleto' } } }
            ]
          }
        });

      const localFixture = TestBed.createComponent(DeletePatientReportComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      localComponent['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro: Identificador do laudo não encontrado.');
      expect(patientServiceMock.deletePatientReport).not.toHaveBeenCalled();
    });

    it('deve remover o laudo com sucesso, exibir toast e fechar a modal retornando true', () => {
      fixture.detectChanges();
      const mockApiResponse = { message: 'Laudo excluído com sucesso!' };
      patientServiceMock.deletePatientReport.mockReturnValue(of(mockApiResponse));

      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(patientServiceMock.deletePatientReport).toHaveBeenCalledWith(150);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo excluído com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    // 🎯 NOVO: Cobre o branch do fallback de sucesso sem mensagem da API
    it('deve usar mensagem padrão de sucesso se a API retornar um objeto vazio', () => {
      fixture.detectChanges();
      patientServiceMock.deletePatientReport.mockReturnValue(of({})); // Resposta sem .message

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Laudo removido com sucesso!');
    });

    it('deve tratar falhas do servidor, exibir mensagem de erro da API e resetar o estado de carregamento do botão', () => {
      fixture.detectChanges();
      const mockApiError = { error: { message: 'Não é possível remover um laudo vinculado a um processo ativo.' } };
      patientServiceMock.deletePatientReport.mockReturnValue(throwError(() => mockApiError));

      component['onSubmit']();

      expect(patientServiceMock.deletePatientReport).toHaveBeenCalledWith(150);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(mockApiError.error.message);
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    // 🎯 NOVO: Cobre o branch do fallback de erro genérico se a API falhar sem payload estruturado
    it('deve usar mensagem de erro genérica se o servidor falhar sem retornar corpo de erro', () => {
      fixture.detectChanges();
      const rawError = { status: 500 }; // Sem err.error.message
      patientServiceMock.deletePatientReport.mockReturnValue(throwError(() => rawError));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar remover o laudo.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});