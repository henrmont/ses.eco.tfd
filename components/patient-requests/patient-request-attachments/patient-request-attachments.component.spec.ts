// src/app/tfd/components/patient-requests/patient-request-attachments/patient-request-attachments.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { saveAs } from 'file-saver';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PatientRequestAttachmentDialogData,
  PatientRequestAttachmentsComponent,
} from './patient-request-attachments.component';
import { MessageService } from '../../../../core/services/message.service';
import { StorageService } from '../../../../core/services/storage.service';
import { PatientRequest } from '../../../models/patient-request.model';
import { PatientRequestAttachment } from '../../../models/patient-request-attachment.model';
import { PatientRequestService } from '../../../services/patient-request.service';
import { PatientRequestAttachmentCreateComponent } from '../patient-request-attachment-create/patient-request-attachment-create.component';
import { PatientRequestAttachmentDeleteComponent } from '../patient-request-attachment-delete/patient-request-attachment-delete.component';
import { PatientRequestAttachmentUpdateComponent } from '../patient-request-attachment-update/patient-request-attachment-update.component';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent<string>) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
  }
}

describe('PatientRequestAttachmentsComponent', () => {
  let component: PatientRequestAttachmentsComponent;
  let fixture: ComponentFixture<PatientRequestAttachmentsComponent>;

  let createdChannels: MockBroadcastChannel[];
  let patientRequestServiceMock: {
    getPatientRequestAttachments: ReturnType<typeof vi.fn>;
  };
  let storageServiceMock: {
    download: ReturnType<typeof vi.fn>;
  };
  let messageServiceMock: {
    showMessage: ReturnType<typeof vi.fn>;
  };
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;
  let afterClosedSubject$: Subject<unknown>;

  const mockAttachments: PatientRequestAttachment[] = [
    { id: 1, name: 'Exame de Sangue', archive_id: 101 } as unknown as PatientRequestAttachment,
    { id: 2, name: 'Laudo Médico', archive_id: 102 } as unknown as PatientRequestAttachment,
  ];

  const defaultDialogData: PatientRequestAttachmentDialogData = {
    patient_request: { id: 88 } as unknown as PatientRequest,
  };

  async function createComponent(
    dialogData: PatientRequestAttachmentDialogData | null = defaultDialogData
  ): Promise<void> {
    afterClosedSubject$ = new Subject<unknown>();

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [PatientRequestAttachmentsComponent],
        providers: [
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: PatientRequestService, useValue: patientRequestServiceMock },
          { provide: StorageService, useValue: storageServiceMock },
          { provide: MessageService, useValue: messageServiceMock },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(PatientRequestAttachmentsComponent, {
        set: { template: '' },
      })
      .compileComponents();

    dialogOpenSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
      afterClosed: () => afterClosedSubject$.asObservable(),
    } as unknown as MatDialogRef<unknown, unknown>);

    fixture = TestBed.createComponent(PatientRequestAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.mocked(saveAs).mockReset();
    createdChannels = [];

    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function (name: string) {
        const channel = new MockBroadcastChannel(name);
        createdChannels.push(channel);
        return channel;
      })
    );

    patientRequestServiceMock = {
      getPatientRequestAttachments: vi.fn().mockReturnValue(of(mockAttachments)),
    };

    storageServiceMock = {
      download: vi.fn(),
    };

    messageServiceMock = {
      showMessage: vi.fn(),
    };

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('deve criar o componente, abrir os 5 BroadcastChannels, carregar anexos e fechar canais ao destruir', async () => {
    expect(component).toBeTruthy();
    expect(createdChannels.map((c) => c.name)).toEqual([
      'tfd-patient-requests-channel',
      'tfd-opinions-channel',
      'tfd-travels-channel',
      'tfd-cost-assistances-channel',
      'tfd-accountabilities-channel',
    ]);
    expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledWith(88);
    expect(component['isLoading']()).toBe(false);
    expect(component['dataSource'].data).toEqual(mockAttachments);

    const closedCountBeforeDestroy = createdChannels.filter(
      (c) => c.close.mock.calls.length > 0
    ).length;
    expect(closedCountBeforeDestroy).toBe(0);

    await createComponent(null);
    expect(component['isLoading']()).toBe(false);
    expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledTimes(1);

    const lastFiveChannels = createdChannels.slice(-5);
    fixture.destroy();
    lastFiveChannels.forEach((channel) => {
      expect(channel.close).toHaveBeenCalledTimes(1);
    });
  });

  it('deve atualizar anexos quando algum BroadcastChannel receber "update" e ignorar outras mensagens', () => {
    patientRequestServiceMock.getPatientRequestAttachments.mockClear();
    const updatedList = [mockAttachments[0]];
    patientRequestServiceMock.getPatientRequestAttachments.mockReturnValue(of(updatedList));

    createdChannels[0].onmessage?.({ data: 'ignorar' } as MessageEvent<string>);
    expect(patientRequestServiceMock.getPatientRequestAttachments).not.toHaveBeenCalled();

    const loadingValues: boolean[] = [];
    const pending$ = new Subject<PatientRequestAttachment[]>();
    patientRequestServiceMock.getPatientRequestAttachments.mockReturnValueOnce(pending$.asObservable());

    createdChannels[2].onmessage?.({ data: 'update' } as MessageEvent<string>);
    loadingValues.push(component['isLoading']());
    pending$.next(updatedList);
    pending$.complete();

    expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledWith(88);
    expect(loadingValues).toEqual([false]);
    expect(component['dataSource'].data).toEqual(updatedList);
  });

  it('deve limpar dataSource e exibir mensagem da API ou fallback ao falhar ao carregar anexos', async () => {
    patientRequestServiceMock.getPatientRequestAttachments.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Sem permissão para listar anexos.' } }))
    );
    await createComponent();
    expect(component['dataSource'].data).toEqual([]);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Sem permissão para listar anexos.'
    );

    patientRequestServiceMock.getPatientRequestAttachments.mockReturnValueOnce(
      throwError(() => new Error('Erro de rede'))
    );
    await createComponent();
    expect(component['dataSource'].data).toEqual([]);
    expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
      'Não foi possível carregar os anexos da solicitação.'
    );
  });

  describe('Download de Anexo (download)', () => {
    it('deve ignorar archiveId nulo/indefinido ou já em andamento para o mesmo archiveId', () => {
      component['download'](null, 'Doc');
      component['download'](undefined, 'Doc');
      expect(storageServiceMock.download).not.toHaveBeenCalled();

      const pending$ = new Subject<{ archive?: Blob }>();
      storageServiceMock.download.mockReturnValueOnce(pending$.asObservable());

      component['download'](101, '  Exame Sangue  ');
      expect(component['downloadingArchiveId']()).toBe(101);
      expect(storageServiceMock.download).toHaveBeenCalledWith('tfd', 101);

      component['download'](101, 'Duplicado');
      expect(storageServiceMock.download).toHaveBeenCalledTimes(1);

      const blob = new Blob(['conteudo']);
      pending$.next({ archive: blob });
      pending$.complete();

      expect(component['downloadingArchiveId']()).toBeNull();
      expect(saveAs).toHaveBeenCalledWith(blob, 'Exame Sangue');
    });

    it('deve usar nome fallback quando name não for informado, ignorar sem archive e tratar erro', () => {
      const blob = new Blob(['conteudo']);
      storageServiceMock.download.mockReturnValueOnce(of({ archive: blob }));
      component['download'](105);
      expect(saveAs).toHaveBeenCalledWith(blob, 'anexo-105');

      storageServiceMock.download.mockReturnValueOnce(of({}));
      component['download'](106, 'Sem Archive');
      expect(saveAs).toHaveBeenCalledTimes(1);

      storageServiceMock.download.mockReturnValueOnce(
        throwError(() => ({ error: { message: 'Arquivo não encontrado.' } }))
      );
      component['download'](107, 'Erro API');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith('Arquivo não encontrado.');
      expect(component['downloadingArchiveId']()).toBeNull();

      storageServiceMock.download.mockReturnValueOnce(throwError(() => new Error('Falha')));
      component['download'](108, 'Erro Genérico');
      expect(messageServiceMock.showMessage).toHaveBeenCalledWith(
        'Erro ao realizar o download do arquivo.'
      );
      expect(component['downloadingArchiveId']()).toBeNull();
    });
  });

  describe('Ações de Diálogo (Create, Update, Delete)', () => {
    it('deve abrir modal de criação, recarregar e notificar todos os canais quando fechado com sucesso', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();
      const activeChannels = createdChannels.slice(-5);
      activeChannels.forEach((c) => c.postMessage.mockClear());

      component['patientRequestAttachmentCreate']();

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        PatientRequestAttachmentCreateComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          scrollStrategy: expect.anything(),
          data: { patient_request: { id: 88 } },
        })
      );

      afterClosedSubject$.next(true);
      afterClosedSubject$.complete();

      expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledWith(88);
      activeChannels.forEach((channel) => {
        expect(channel.postMessage).toHaveBeenCalledWith('update');
      });
    });

    it('deve abrir modal de atualização e não recarregar nem notificar quando fechado sem sucesso', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();
      const activeChannels = createdChannels.slice(-5);
      activeChannels.forEach((c) => c.postMessage.mockClear());

      const targetAttachment = mockAttachments[0];
      component['patientRequestAttachmentUpdate'](targetAttachment);

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        PatientRequestAttachmentUpdateComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          data: {
            patient_request: { id: 88 },
            patient_request_attachment: targetAttachment,
          },
        })
      );

      afterClosedSubject$.next(false);
      afterClosedSubject$.complete();

      expect(patientRequestServiceMock.getPatientRequestAttachments).not.toHaveBeenCalled();
      activeChannels.forEach((channel) => {
        expect(channel.postMessage).not.toHaveBeenCalled();
      });
    });

    it('deve abrir modal de exclusão e recarregar quando fechado com sucesso', () => {
      patientRequestServiceMock.getPatientRequestAttachments.mockClear();
      const targetAttachment = mockAttachments[1];

      component['patientRequestAttachmentDelete'](targetAttachment);

      expect(dialogOpenSpy).toHaveBeenCalledWith(
        PatientRequestAttachmentDeleteComponent,
        expect.objectContaining({
          width: '400px',
          height: 'auto',
          disableClose: true,
          autoFocus: false,
          data: {
            patient_request: { id: 88 },
            patient_request_attachment: targetAttachment,
          },
        })
      );

      afterClosedSubject$.next(true);
      afterClosedSubject$.complete();

      expect(patientRequestServiceMock.getPatientRequestAttachments).toHaveBeenCalledWith(88);
    });
  });
});