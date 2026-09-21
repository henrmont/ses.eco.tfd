import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { PatientReportsComponent } from './patient-reports-component';
import { PatientService } from '../../../services/patient-service';
import { ShowPatientReportComponent } from '../show-patient-report-component/show-patient-report-component';
import { CreatePatientReportComponent } from '../create-patient-report-component/create-patient-report-component';
import { UpdatePatientReportComponent } from '../update-patient-report-component/update-patient-report-component';
import { DeletePatientReportComponent } from '../delete-patient-report-component/delete-patient-report-component';
import { ReportAttachmentsComponent } from '../report-attachments-component/report-attachments-component';

describe('PatientReportsComponent', () => {
  let component: PatientReportsComponent;
  let fixture: ComponentFixture<PatientReportsComponent>;

  // Mocks das dependências
  let patientServiceMock: any;
  let dialogMock: any;
  let dialogRefMock: any;
  let broadcastChannelSpy: any;

  // Dados falsos de entrada via MAT_DIALOG_DATA
  const mockDialogData = {
    patient_care: {
      id: 45
    }
  };

  // Massa de dados de laudos mockados
  const mockReportsResponse = [
    { id: 1, protocol: 'LAUDO-2026-001', cid: { code: 'U07.1', name: 'COVID-19' } },
    { id: 2, protocol: 'LAUDO-2026-002', cid: { code: 'I10', name: 'Hipertensão essencial' } }
  ];

  beforeEach(async () => {
    patientServiceMock = {
      getPatientReports: vi.fn().mockReturnValue(of(mockReportsResponse))
    };

    dialogRefMock = {
      afterClosed: vi.fn().mockReturnValue(of(true)) // Simula que o usuário confirmou ações nas modais filhas
    };

    dialogMock = {
      open: vi.fn().mockReturnValue(dialogRefMock)
    };

    // Espiona o BroadcastChannel global para garantir que o canal de sincronização seja acionado
    broadcastChannelSpy = vi.spyOn(BroadcastChannel.prototype, 'postMessage');

    await TestBed.configureTestingModule({
      imports: [PatientReportsComponent]
    })
    .overrideComponent(PatientReportsComponent, {
      set: {
        providers: [
          { provide: PatientService, useValue: patientServiceMock },
          { provide: MatDialog, useValue: dialogMock },
          { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientReportsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização e Fluxo de Carga Inicial', () => {
    it('deve instanciar o componente com sucesso', () => {
      fixture.detectChanges(); // Dispara o ngOnInit
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de laudos reativamente e alimentar o dataSource (computed)', () => {
      fixture.detectChanges();

      // Garante que chamou o serviço usando o ID do atendimento correto
      expect(patientServiceMock.getPatientReports).toHaveBeenCalledWith(45);
      
      // Valida se o sinal bruto foi atualizado
      expect(component['reportsList']()).toEqual(mockReportsResponse);
      
      // Valida se o computed do dataSource gerou a instância correta com os dados populados
      expect(component['dataSource']()).toBeInstanceOf(MatTableDataSource);
      expect(component['dataSource']().data).toEqual(mockReportsResponse);
      
      // O loading deve ter sido desativado ao concluir
      expect(component['isLoading']()).toBe(false);
    });

    it('deve desativar o spinner e não quebrar se o id do atendimento estiver ausente (Garda Preventiva)', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [PatientReportsComponent] })
        .overrideComponent(PatientReportsComponent, {
          set: {
            providers: [
              { provide: PatientService, useValue: patientServiceMock },
              { provide: MatDialog, useValue: dialogMock },
              { provide: MAT_DIALOG_DATA, useValue: { patient_care: { id: null } } } // Alinhado com a guarda
            ]
          }
        });

      const localFixture = TestBed.createComponent(PatientReportsComponent);
      const localComponent = localFixture.componentInstance;
      localFixture.detectChanges();

      expect(patientServiceMock.getPatientReports).not.toHaveBeenCalled();
      expect(localComponent['isLoading']()).toBe(false);
    });

    it('deve desligar o loading mesmo se a API falhar no ciclo de inicialização', () => {
      patientServiceMock.getPatientReports.mockReturnValue(throwError(() => new Error('Erro de Conexão')));
      fixture.detectChanges();

      expect(component['isLoading']()).toBe(false);
      expect(component['reportsList']()).toEqual([]);
    });
  });

  describe('Abertura de Modais e Fluxos de Ação', () => {
    const targetReport = { id: 1, protocol: 'LAUDO-01', cid: { code: 'A00' } };

    beforeEach(() => {
      fixture.detectChanges(); // Inicializa o estado base antes de testar as ações
    });

    it('deve abrir a modal ShowPatientReportComponent em modo de visualização pura', () => {
      component['showPatientReport'](targetReport);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowPatientReportComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report: targetReport }
      });
      // Telas de visualização pura não devem emitir eventos de update no BroadcastChannel
      expect(broadcastChannelSpy).not.toHaveBeenCalled();
    });

    it('deve abrir a modal CreatePatientReportComponent, atualizar a grid em background e notificar o sistema ao fechar com sucesso', () => {
      // Reseta o histórico de chamadas do init para podermos contar os disparos pós-modal
      patientServiceMock.getPatientReports.mockClear();

      component['createPatientReport']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreatePatientReportComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_care: mockDialogData.patient_care }
      });

      // Como o mock do dialogRef devolve 'true', as lógicas do bloco .subscribe() precisam rodar:
      expect(patientServiceMock.getPatientReports).toHaveBeenCalledWith(45);
      expect(broadcastChannelSpy).toHaveBeenCalledWith('update');
      // O loading deve continuar falso pois a atualização é fluida (background)
      expect(component['isLoading']()).toBe(false);
    });

    it('deve abrir a modal UpdatePatientReportComponent e atualizar registros fluidamente se houver confirmação', () => {
      patientServiceMock.getPatientReports.mockClear();

      component['updatePatientReport'](targetReport);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdatePatientReportComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report: targetReport }
      });

      expect(patientServiceMock.getPatientReports).toHaveBeenCalled();
      expect(broadcastChannelSpy).toHaveBeenCalledWith('update');
    });

    it('deve abrir a modal DeletePatientReportComponent acionando o spinner principal antes de recarregar a grid', () => {
      patientServiceMock.getPatientReports.mockClear();

      component['deletePatientReport'](targetReport);

      expect(dialogMock.open).toHaveBeenCalledWith(DeletePatientReportComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report: targetReport }
      });

      // Diferencial do delete: ele ativa o showLoading para limpar o registro deletado visualmente
      expect(patientServiceMock.getPatientReports).toHaveBeenCalled();
      expect(broadcastChannelSpy).toHaveBeenCalledWith('update');
    });

    it('deve abrir o gerenciador ReportAttachmentsComponent sem propagar atualizações globais', () => {
      component['reportAttachments'](targetReport);

      expect(dialogMock.open).toHaveBeenCalledWith(ReportAttachmentsComponent, {
        width: '600px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report: targetReport }
      });
      expect(broadcastChannelSpy).not.toHaveBeenCalled();
    });

    it('não deve recarregar os dados nem enviar mensagens se as modais forem fechadas sem confirmação (retorno falso/nulo)', () => {
      // Configura temporariamente o retorno do fechamento da modal para falso
      dialogRefMock.afterClosed.mockReturnValue(of(false));
      patientServiceMock.getPatientReports.mockClear();
      broadcastChannelSpy.mockClear();

      component['createPatientReport']();

      expect(patientServiceMock.getPatientReports).not.toHaveBeenCalled();
      expect(broadcastChannelSpy).not.toHaveBeenCalled();
    });
  });
});