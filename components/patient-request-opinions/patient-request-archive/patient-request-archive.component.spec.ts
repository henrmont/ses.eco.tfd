import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ArchivePatientRequestComponent } from './archive-patient-request-component';
import { OpinionService } from '../../../services/opinion-service';
import { MessageService } from '../../../../core/services/message-service';

describe('ArchivePatientRequestComponent', () => {
  let component: ArchivePatientRequestComponent;
  let fixture: ComponentFixture<ArchivePatientRequestComponent>;

  let opinionServiceMock: any;
  let messageServiceMock: any;
  let dialogRefMock: any;
  let mockDialogData: any;

  beforeEach(async () => {
    // Garante que cada teste possua sua própria cópia limpa isolada por referência
    mockDialogData = {
      patient_request: {
        id: 552
      }
    };

    opinionServiceMock = {
      archivePatientRequest: vi.fn()
    };

    messageServiceMock = {
      showMessage: vi.fn()
    };

    dialogRefMock = {
      close: vi.fn()
    };

    opinionServiceMock.archivePatientRequest.mockReturnValue(
      of({ message: 'Solicitação arquivada com sucesso!' })
    );

    await TestBed.configureTestingModule({
      imports: [ArchivePatientRequestComponent],
      providers: [
        provideAnimationsAsync('noop'),
        { provide: OpinionService, useValue: opinionServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
        { provide: MatDialogRef, useValue: dialogRefMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchivePatientRequestComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com o estado inicial de submissão desativado', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('Fluxo de Execução - onSubmit()', () => {

    it('deve exibir mensagem de erro se o id do request não for informado', () => {
      component['data'].patient_request.id = null;

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro: Identificador da solicitação não encontrado.'
      );
      expect(opinionServiceMock.archivePatientRequest).not.toHaveBeenCalled();
      expect(component['isSubmitting']()).toBe(false);
    });

    it('deve arquivar a solicitação passando o id correto e fechar a modal', () => {
      component['onSubmit']();

      expect(component['isSubmitting']()).toBe(true);
      expect(opinionServiceMock.archivePatientRequest).toHaveBeenCalledWith(552);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação arquivada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve usar mensagem de fallback no sucesso se a API não retornar uma mensagem explícita', () => {
      opinionServiceMock.archivePatientRequest.mockReturnValue(of({}));

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Solicitação arquivada com sucesso!');
      expect(dialogRefMock.close).toHaveBeenCalledWith(true);
    });

    it('deve tratar erro estruturado enviado pela API e restaurar estado de submissão', () => {
      opinionServiceMock.archivePatientRequest.mockReturnValue(
        throwError(() => ({ error: { message: 'Erro ao processar o arquivamento.' } }))
      );

      component['onSubmit']();

      expect(opinionServiceMock.archivePatientRequest).toHaveBeenCalledWith(552);
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Erro ao processar o arquivamento.');
      expect(component['isSubmitting']()).toBe(false);
      expect(dialogRefMock.close).not.toHaveBeenCalled();
    });

    it('deve usar mensagem de erro genérica de fallback se a API falhar sem retornar uma mensagem', () => {
      opinionServiceMock.archivePatientRequest.mockReturnValue(
        throwError(() => ({ error: null }))
      );

      component['onSubmit']();

      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Ocorreu um erro ao tentar arquivar a solicitação.');
      expect(component['isSubmitting']()).toBe(false);
    });
  });
});