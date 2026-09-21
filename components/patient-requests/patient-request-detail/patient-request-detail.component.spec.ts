import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { provideNgxMask } from 'ngx-mask';

import { ShowPatientRequestComponent } from './show-patient-request-component';
import { StorageService } from '../../../../core/services/storage-service';
import { saveAs } from 'file-saver';

// Importação dos sub-componentes gerenciados
import { ShowPatientComponent } from '../../patient/show-patient-component/show-patient-component';
import { ShowPatientReportComponent } from '../../patient/show-patient-report-component/show-patient-report-component';
import { ShowOpinionComponent } from '../../opinion/show-opinion-component/show-opinion-component';
import { ShowTravelComponent } from '../../travel/show-travel-component/show-travel-component';
import { ShowCostAssistanceComponent } from '../../cost-assistance/show-cost-assistance-component/show-cost-assistance-component';
import { ShowAccountabilityComponent } from '../../accountability/show-accountability-component/show-accountability-component';

// Mock global da biblioteca file-saver para interceptar o download de arquivos binários
vi.mock('file-saver', () => ({
  saveAs: vi.fn()
}));

describe('ShowPatientRequestComponent', () => {
  let component: ShowPatientRequestComponent;
  let fixture: ComponentFixture<ShowPatientRequestComponent>;
  let mockStorageService: any;
  let dialogOpenSpy: any;

  // Massa de dados mockada simulando a estrutura completa da Solicitação de Paciente (PatientRequest)
  const mockPatientRequestData = {
    patient_request: {
      type: 'Tratamento',
      consultation_date: '2026-08-15',
      observation: 'Paciente necessita de transporte prioritário.',
      report: {
        cid: { code: 'M54.5', name: 'Dor lombar baixa' },
        patient_care: {
          id: 10,
          patient: { name: 'João da Silva Santos', cns: '123456789012345' }
        }
      },
      owner_professional: { name: 'Atendente Maria' },
      medical_professional: { name: 'Dr. Roberto Clínico' },
      medical_approved_opinion: { id: 1, description: 'Parecer Médico Deferido' },
      social_professional: { name: 'Assistente Social Neuza' },
      social_approved_opinion: { id: 2, description: 'Parecer Social Deferido' },
      travel_professional: { name: 'Gestor de Viagens Carlos' },
      cost_assistance_professional: { name: 'Financeiro Pedro' },
      accountability_professional: { name: 'Contador Lucas' },
      payment_professional: { name: 'Tesoureiro Marcos' },
      attachments: [{ name: 'laudo_medico.pdf', archive_id: 101 }],
      travels: [{ origin: 'Cuiabá', destination: 'São Paulo', transportation: 'Aéreo', departure_date: '2026-08-14', locator: 'XYZ123' }],
      cost_assistances: [{ name: 'Auxílio Refeição', type: 'Alimentação', created_at: '2026-06-10' }],
      accountabilities: [{ name: 'Prestação Viagem SP', created_at: '2026-06-15' }],
      payment_info: { description: 'Pagamento efetuado via PIX.' },
      payment_attachments: [{ name: 'comprovante_pix.pdf', archive_id: 202 }]
    }
  };

  beforeEach(async () => {
    // Mock robusto do serviço de armazenamento
    mockStorageService = {
      download: vi.fn().mockReturnValue(of({ archive: new Blob(['fake-binary-data'], { type: 'application/pdf' }) }))
    };

    await TestBed.configureTestingModule({
      imports: [
        ShowPatientRequestComponent, 
        MatDialogModule
      ],
      providers: [
        provideNgxMask(),
        { provide: MAT_DIALOG_DATA, useValue: mockPatientRequestData },
        { provide: StorageService, useValue: mockStorageService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ShowPatientRequestComponent);
    component = fixture.componentInstance;
    
    // 👈 SEGREDO DA CORREÇÃO: Pegamos a instância exata do dialog de dentro do próprio componente
    // Nota: Se sua propriedade no construtor do TS se chamar algo diferente de 'dialog' (ex: 'matDialog'), mude abaixo:
    const componentDialogInstance = (component as any).dialog;

    // Criamos o spy diretamente nela antes de rodar o detectChanges()
    dialogOpenSpy = vi.spyOn(componentDialogInstance, 'open').mockReturnValue({
      afterClosed: vi.fn().mockReturnValue(of(true))
    } as any);

    fixture.detectChanges();
  });

  it('deve criar o componente agregador com sucesso', () => {
    expect(component).toBeTruthy();
  });

  it('deve unificar e expor os dados agregados do paciente corretamente para o template', () => {
    expect((component as any).patient).toBeDefined();
    expect((component as any).patient.name).toBe('João da Silva Santos');
    expect((component as any).patient.id).toBe(10);
  });

  it('deve chamar o StorageService e executar o download local através do saveAs', () => {
    const archiveId = 101;
    const fileName = 'laudo_medico.pdf';

    (component as any).download(archiveId, fileName);

    expect(mockStorageService.download).toHaveBeenCalledWith(archiveId);
    expect(saveAs).toHaveBeenCalledWith(expect.any(Blob), fileName);
  });

  it('não deve disparar o StorageService se o id do arquivo for inválido ou nulo', () => {
    (component as any).download(null as any, 'arquivo.pdf');
    expect(mockStorageService.download).not.toHaveBeenCalled();
  });

  describe('Fluxos de Abertura de Sub-Modais', () => {
    
    it('deve abrir o modal ShowPatientComponent com os dados unificados e dimensões de 1200px', () => {
      const mockPatient = (component as any).patient;
      (component as any).showPatient(mockPatient);

      expect(dialogOpenSpy).toHaveBeenCalledWith(ShowPatientComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
        data: { patient_care: mockPatient }
      });
    });

    it('deve abrir o modal ShowPatientReportComponent com os dados do laudo/CID', () => {
      const report = mockPatientRequestData.patient_request.report;
      (component as any).showPatientReport(report);

      expect(dialogOpenSpy).toHaveBeenCalledWith(ShowPatientReportComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { report }
      });
    });

    it('deve abrir o modal ShowOpinionComponent com os dados do parecer médico ou social', () => {
      const opinion = mockPatientRequestData.patient_request.medical_approved_opinion;
      (component as any).showOpinion(opinion);

      expect(dialogOpenSpy).toHaveBeenCalledWith(ShowOpinionComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
        data: { opinion }
      });
    });

    it('deve abrir o modal ShowTravelComponent com os dados detalhados do trecho e localizador', () => {
      const travel = mockPatientRequestData.patient_request.travels[0];
      (component as any).showTravel(travel);

      expect(dialogOpenSpy).toHaveBeenCalledWith(ShowTravelComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { travel }
      });
    });

    it('deve abrir o modal ShowCostAssistanceComponent com as informações da ajuda de custo', () => {
      const costAssistance = mockPatientRequestData.patient_request.cost_assistances[0];
      (component as any).showCostAssistance(costAssistance);

      expect(dialogOpenSpy).toHaveBeenCalledWith(ShowCostAssistanceComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { cost_assistance: costAssistance }
      });
    });

    it('deve abrir o modal ShowAccountabilityComponent com os detalhes da prestação de contas', () => {
      const accountability = mockPatientRequestData.patient_request.accountabilities[0];
      (component as any).showAccountability(accountability);

      expect(dialogOpenSpy).toHaveBeenCalledWith(ShowAccountabilityComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { accountability }
      });
    });

  });
});