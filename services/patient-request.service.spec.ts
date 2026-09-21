import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PatientRequestService, ApiResponse } from './patient-request-service';
import { environment } from '../../../environments/environment
';
import { PatientRequest } from '../models/patient-request';
import { Patient } from '../models/patient';
import { HospitalUnity } from '../models/hospital-unity';
import { Professional } from '../models/professional';
import { PatientRequestAttachment } from '../models/patient-request-attachment';
import * as momentImport from 'moment';

const moment = (momentImport as any).default || momentImport;

describe('PatientRequestService', () => {
  let service: PatientRequestService;
  let httpMock: HttpTestingController;

  const mockApiUrl = `${environment.apiTfdUrl}/patient-request`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PatientRequestService]
    });

    service = TestBed.inject(PatientRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve ser criado com sucesso', () => {
    expect(service).toBeTruthy();
  });

  // ==========================================
  // BLOCO 1: CONSULTAS / GETTERS
  // ==========================================

  it('deve buscar as solicitações de pacientes (getPatientRequests)', () => {
    const mockRequests: PatientRequest[] = [{ id: 1, type: 'Consulta' } as any];

    service.getPatientRequests().subscribe(res => {
      expect(res.length).toBe(1);
      expect(res).toEqual(mockRequests);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-patient-requests`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRequests);
  });

  it('deve buscar a lista de pacientes (getPatients)', () => {
    const mockPatients: Patient[] = [{ id: 10, name: 'Carlos Solicitante' } as any];

    service.getPatients().subscribe(res => {
      expect(res).toEqual(mockPatients);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-patients`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPatients);
  });

  it('deve buscar prontuários vinculados (getReports)', () => {
    service.getReports(45).subscribe(res => {
      expect(res).toEqual([]);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-patient-reports/45`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('deve buscar unidades hospitalares (getHospitalUnities)', () => {
    const mockUnities: HospitalUnity[] = [{ id: 2, name: 'Hospital Central' } as any];

    service.getHospitalUnities().subscribe(res => {
      expect(res).toEqual(mockUnities);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-hospital-unities`);
    expect(req.request.method).toBe('GET');
    req.flush(mockUnities);
  });

  it('deve buscar profissionais médicos (getMedicalProfessionals)', () => {
    const mockProfessionals: Professional[] = [{ id: 5, name: 'Dr. Roberto' } as any];

    service.getMedicalProfessionals().subscribe(res => {
      expect(res).toEqual(mockProfessionals);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-medical-professionals`);
    expect(req.request.method).toBe('GET');
    req.flush(mockProfessionals);
  });

  it('deve buscar anexos de uma solicitação (getPatientRequestAttachments)', () => {
    const mockAttachments: PatientRequestAttachment[] = [{ id: 12, file_name: 'laudo.pdf' } as any];

    service.getPatientRequestAttachments(1).subscribe(res => {
      expect(res).toEqual(mockAttachments);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-patient-request-attachments/1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockAttachments);
  });

  // ==========================================
  // BLOCO 2: OPERAÇÕES DA SOLICITAÇÃO (MUTATIONS)
  // ==========================================

  it('deve criar uma solicitação de paciente (createPatientRequest)', () => {
    const mockData: PatientRequest = { type: 'Exame' } as any;
    const mockResponse: ApiResponse = { message: 'Solicitação aberta' };

    service.createPatientRequest(mockData).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/create-patient-request`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockData);
    req.flush(mockResponse);
  });

  it('deve atualizar uma solicitação (updatePatientRequest)', () => {
    const mockData: PatientRequest = { type: 'Exame Alterado' } as any;
    const mockResponse: ApiResponse = { message: 'Solicitação alterada' };

    service.updatePatientRequest(7, mockData).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/update-patient-request/7`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(mockData);
    req.flush(mockResponse);
  });

  it('deve deletar uma solicitação (deletePatientRequest)', () => {
    const mockResponse: ApiResponse = { message: 'Solicitação removida' };

    service.deletePatientRequest(7).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/delete-patient-request/7`);
    expect(req.request.method).toBe('DELETE');
    req.flush(mockResponse);
  });

  it('deve sobrestar/pausar uma solicitação com corpo vazio (haltedPatientRequest)', () => {
    const mockResponse: ApiResponse = { message: 'Solicitação sobrestada' };

    service.haltedPatientRequest(3).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/halted-patient-request/3`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({}); // Garante que envia um corpo vazio
    req.flush(mockResponse);
  });

  it('deve tramitar solicitação para área médica (processPatientRequestToMedical)', () => {
    const mockData = { professional_id: 5 };
    const mockResponse: ApiResponse = { message: 'Tramitado com sucesso' };

    service.processPatientRequestToMedical(3, mockData).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/process-patient-request-to-medical/3`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(mockData);
    req.flush(mockResponse);
  });

  // ==========================================
  // BLOCO 3: TRÂMITE ENTRE CAIXAS E FLUXOS
  // ==========================================

  it('deve mover solicitação a partir de processos (movePatientRequestFromProcesses)', () => {
    const mockResponse: ApiResponse = { message: 'Retornado para Minha Caixa' };

    service.movePatientRequestFromProcesses(1).subscribe(res => expect(res).toEqual(mockResponse));

    const req = httpMock.expectOne(`${mockApiUrl}/move-patient-request-from-processes/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(mockResponse);
  });

  it('deve mover solicitação a partir de outras caixas (movePatientRequestFromOthers)', () => {
    const mockResponse: ApiResponse = { message: 'Puxado para Minha Caixa' };

    service.movePatientRequestFromOthers(1).subscribe(res => expect(res).toEqual(mockResponse));

    const req = httpMock.expectOne(`${mockApiUrl}/move-patient-request-from-others/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(mockResponse);
  });

  it('deve restaurar solicitação a partir do arquivo (movePatientRequestFromArchive)', () => {
    const mockResponse: ApiResponse = { message: 'Desarquivado' };

    service.movePatientRequestFromArchive(1).subscribe(res => expect(res).toEqual(mockResponse));

    const req = httpMock.expectOne(`${mockApiUrl}/move-patient-request-from-archive/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({});
    req.flush(mockResponse);
  });

  // ==========================================
  // BLOCO 4: ANEXOS DA SOLICITAÇÃO (MULTIPART)
  // ==========================================

  it('deve criar um anexo montando o FormData corretamente (createPatientRequestAttachment)', () => {
    const mockResponse: ApiResponse = { message: 'Upload concluído' };
    const mockPayload = {
      description: 'Documento RG',
      date: moment('2026-06-17'),
      file: new File(['content'], 'rg.pdf', { type: 'application/pdf' })
    };

    service.createPatientRequestAttachment(9, mockPayload).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/create-patient-request-attachment/9`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(mockResponse);
  });

  it('deve atualizar um anexo usando FormData (updatePatientRequestAttachment)', () => {
    const mockResponse: ApiResponse = { message: 'Anexo modificado' };
    const mockPayload = { description: 'Nova Descrição' };

    service.updatePatientRequestAttachment(12, mockPayload).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/update-patient-request-attachment/12`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(mockResponse);
  });

  it('deve deletar um anexo (deletePatientRequestAttachment)', () => {
    const mockResponse: ApiResponse = { message: 'Anexo removido' };

    service.deletePatientRequestAttachment(12).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/delete-patient-request-attachment/12`);
    expect(req.request.method).toBe('DELETE');
    req.flush(mockResponse);
  });

  // ==========================================
  // BLOCO 5: MÉTODO PRIVADO mountFormData
  // ==========================================

  it('deve retornar um FormData vazio se o payload fornecido for nulo', () => {
    const formData: FormData = (service as any).mountFormData(null);
    expect(formData.has('any')).toBe(false);
  });
});