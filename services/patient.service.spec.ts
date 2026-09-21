import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormControl, ValidationErrors } from '@angular/forms';
import { PatientService, ApiResponse } from './patient-service';
import { environment } from '../../../environments/environment
';
import { Patient } from '../models/patient';
import { Escort } from '../models/escort';
import { ReportAttachment } from '../models/report-attachment';
import { PatientCare } from '../models/patient-care.model';
import { Observable } from 'rxjs';
import * as momentImport from 'moment';

const moment = (momentImport as any).default || momentImport;

describe('PatientService', () => {
  let service: PatientService;
  let httpMock: HttpTestingController;

  const mockApiUrl = `${environment.apiTfdUrl}/patient`;
  const mockChecksUrl = `${environment.apiTfdUrl}/checks`;
  const mockValidatorUrl = `${environment.apiTfdUrl}/validator`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PatientService]
    });

    service = TestBed.inject(PatientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve ser criado', () => {
    expect(service).toBeTruthy();
  });

  // ==========================================
  // FLUXO DE PACIENTES
  // ==========================================

  it('deve buscar pacientes (getPatients)', () => {
    const mockPatients: Patient[] = [{ id: 1, name: 'João Silva' } as any];

    service.getPatients().subscribe(patients => {
      expect(patients.length).toBe(1);
      expect(patients).toEqual(mockPatients);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/get-patients`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPatients);
  });

  it('deve criar um paciente utilizando FormData (createPatient)', () => {
    const mockData = { name: 'Maria', birth: moment('2026-01-01'), file: new File([''], 'doc.pdf') };
    const mockResponse: ApiResponse = { message: 'Paciente criado com sucesso' };

    service.createPatient(mockData).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/create-patient`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(mockResponse);
  });

  it('deve atualizar um paciente utilizando FormData (updatePatient)', () => {
    const mockData = { name: 'Maria Alterada' };
    const mockResponse: ApiResponse = { message: 'Paciente atualizado' };

    service.updatePatient(1, mockData).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/update-patient/1`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('deve arquivar um paciente (archivePatient)', () => {
    const mockResponse: ApiResponse = { message: 'Arquivado' };

    service.archivePatient(10).subscribe(res => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockApiUrl}/archive-patient/10`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  it('deve mover paciente do arquivo (movePatientFromArchive)', () => {
    const mockResponse: ApiResponse = { message: 'Movido' };
    service.movePatientFromArchive(10).subscribe(res => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${mockApiUrl}/move-patient-from-archive/10`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  it('deve mover paciente de outros fluxos (movePatientFromOthers)', () => {
    const mockResponse: ApiResponse = { message: 'Movido de outros' };
    service.movePatientFromOthers(10).subscribe(res => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${mockApiUrl}/move-patient-from-others/10`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  it('deve validar um paciente (validatePatient)', () => {
    const mockResponse: ApiResponse = { message: 'Validado' };
    service.validatePatient(10).subscribe(res => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${mockApiUrl}/validate-patient/10`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  // ==========================================
  // FLUXO DE ACOMPANHANTES
  // ==========================================

  it('deve buscar acompanhantes do paciente (getPatientEscorts)', () => {
    const mockEscorts: Escort[] = [{ id: 2, name: 'Acompanhante 1' } as any];
    service.getPatientEscorts(5).subscribe(res => expect(res).toEqual(mockEscorts));
    const req = httpMock.expectOne(`${mockApiUrl}/get-patient-escorts/5`);
    expect(req.request.method).toBe('GET');
    req.flush(mockEscorts);
  });

  it('deve criar acompanhante (createPatientEscort)', () => {
    const mockResponse: ApiResponse = { message: 'Acompanhante criado' };
    service.createPatientEscort(5, { name: 'Acom' }).subscribe(res => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${mockApiUrl}/create-patient-escort/5`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('deve atualizar acompanhante (updatePatientEscort)', () => {
    const mockResponse: ApiResponse = { message: 'Acompanhante atualizado' };
    service.updatePatientEscort(2, { name: 'Acom Editado' }).subscribe(res => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${mockApiUrl}/update-patient-escort/2`);
    expect(req.request.method).toBe('PATCH');
    req.flush(mockResponse);
  });

  it('deve deletar acompanhante (deletePatientEscort)', () => {
    const mockResponse: ApiResponse = { message: 'Acompanhante excluído' };
    service.deletePatientEscort(2).subscribe(res => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${mockApiUrl}/delete-patient-escort/2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(mockResponse);
  });

  // ==========================================
  // PRONTUÁRIOS, LAUDOS E CIDS
  // ==========================================

  it('deve buscar prontuários (getPatientReports)', () => {
    service.getPatientReports(1).subscribe(res => expect(res).toEqual([]));
    const req = httpMock.expectOne(`${mockApiUrl}/get-patient-reports/1`);
    req.flush([]);
  });

  it('deve criar prontuário (createPatientReport)', () => {
    const data = { description: 'Laudo médico' };
    service.createPatientReport(1, data).subscribe(res => expect(res.message).toBe('ok'));
    const req = httpMock.expectOne(`${mockApiUrl}/create-patient-report/1`);
    expect(req.request.body).toEqual(data);
    req.flush({ message: 'ok' });
  });

  it('deve atualizar prontuário (updatePatientReport)', () => {
    service.updatePatientReport(1, { text: 'mudei' }).subscribe(res => expect(res.message).toBe('ok'));
    const req = httpMock.expectOne(`${mockApiUrl}/update-patient-report/1`);
    req.flush({ message: 'ok' });
  });

  it('deve deletar prontuário (deletePatientReport)', () => {
    service.deletePatientReport(1).subscribe(res => expect(res.message).toBe('ok'));
    const req = httpMock.expectOne(`${mockApiUrl}/delete-patient-report/1`);
    req.flush({ message: 'ok' });
  });

  it('deve carregar cids (getCids)', () => {
    service.getCids(1).subscribe(res => expect(res).toEqual({ cid: 'M54' }));
    const req = httpMock.expectOne(`${mockApiUrl}/get-cids/1`);
    req.flush({ cid: 'M54' });
  });

  // ==========================================
  // ANEXOS
  // ==========================================

  it('deve buscar anexos (getReportAttachments)', () => {
    const mockAnexos: ReportAttachment[] = [{ id: 99 } as any];
    service.getReportAttachments(1).subscribe(res => expect(res).toEqual(mockAnexos));
    const req = httpMock.expectOne(`${mockApiUrl}/get-report-attachments/1`);
    req.flush(mockAnexos);
  });

  it('deve criar anexo (createReportAttachment)', () => {
    service.createReportAttachment(1, { file: '...' }).subscribe(res => expect(res.message).toBe('ok'));
    const req = httpMock.expectOne(`${mockApiUrl}/create-report-attachment/1`);
    req.flush({ message: 'ok' });
  });

  it('deve editar anexo (updateReportAttachment)', () => {
    service.updateReportAttachment(1, { title: 'novo' }).subscribe(res => expect(res.message).toBe('ok'));
    const req = httpMock.expectOne(`${mockApiUrl}/update-report-attachment/1`);
    req.flush({ message: 'ok' });
  });

  it('deve deletar anexo (deleteReportAttachment)', () => {
    service.deleteReportAttachment(1).subscribe(res => expect(res.message).toBe('ok'));
    const req = httpMock.expectOne(`${mockApiUrl}/delete-report-attachment/1`);
    req.flush({ message: 'ok' });
  });

  // ==========================================
  // CHECKS DIRETOS
  // ==========================================

  it('deve obter dados de acompanhante por CNS ou Documento', () => {
    const mockEscort = { id: 7, name: 'Acompanhante' } as Escort;
    
    service.getEscortCns(123).subscribe(res => expect(res).toEqual(mockEscort));
    const req1 = httpMock.expectOne(`${mockChecksUrl}/get-escort-cns/123`);
    req1.flush(mockEscort);

    service.getEscortDocument(456).subscribe(res => expect(res).toEqual(mockEscort));
    const req2 = httpMock.expectOne(`${mockChecksUrl}/get-escort-document/456`);
    req2.flush(mockEscort);
  });

  // ==========================================
  // VALIDATORS ASSÍNCRONOS (COM CAST E TIPAGEM FIXADA)
  // ==========================================

  describe('cnsPatientExistsValidator', () => {
    it('deve retornar null imediatamente se o campo do controle for nulo/vazio', () => {
      const validator = service.cnsPatientExistsValidator('12345');
      const control = new FormControl('');
      (validator(control) as Observable<ValidationErrors | null>).subscribe(res => expect(res).toBeNull());
    });

    it('deve retornar null se o CNS digitado for idêntico ao CNS atual do paciente (edição)', () => {
      const validator = service.cnsPatientExistsValidator('12345678901');
      const control = new FormControl('12345678901');
      (validator(control) as Observable<ValidationErrors | null>).subscribe(res => expect(res).toBeNull());
    });

    it('deve retornar erro { cnsExists: true } se a API confirmar a existência', () => {
      const validator = service.cnsPatientExistsValidator('1111');
      const control = new FormControl('99999999999');

      (validator(control) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => {
        expect(res).toEqual({ cnsExists: true });
      });

      const req = httpMock.expectOne(`${mockValidatorUrl}/cns-patient-exists/99999999999/1111`);
      req.flush({ cnsExists: true });
    });

    it('deve assumir null (válido) se a chamada de API falhar (fluxo catchError)', () => {
      const validator = service.cnsPatientExistsValidator(null);
      const control = new FormControl('99999999999');

      (validator(control) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => {
        expect(res).toBeNull();
      });

      const req = httpMock.expectOne(`${mockValidatorUrl}/cns-patient-exists/99999999999/`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('cnsEscortExistsValidator', () => {
    const mockPatientCare: PatientCare = { id: 10, patient: { cns: '12345', document: '999' } } as any;

    it('deve retornar null se vazio ou idêntico ao acompanhante atual', () => {
      const validator = service.cnsEscortExistsValidator(mockPatientCare, '777');
      (validator(new FormControl('')) as Observable<ValidationErrors | null>).subscribe(res => expect(res).toBeNull());
      (validator(new FormControl('777')) as Observable<ValidationErrors | null>).subscribe(res => expect(res).toBeNull());
    });

    it('deve acusar erro imediato se o CNS do acompanhante for igual ao do titular do prontuário', () => {
      const validator = service.cnsEscortExistsValidator(mockPatientCare, '777');
      const control = new FormControl('12345');

      (validator(control) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => {
        expect(res).toEqual({ cnsPatientExists: true });
      });
    });

    it('deve disparar requisição HTTP e mapear retorno positivo', () => {
      const validator = service.cnsEscortExistsValidator(mockPatientCare, '777');
      const control = new FormControl('88888');

      (validator(control) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => expect(res).toEqual({ cnsExists: true }));

      const req = httpMock.expectOne(`${mockValidatorUrl}/cns-escort-exists/10/88888/777`);
      req.flush({ cnsExists: true });
    });
  });

  describe('documentPatientExistsValidator', () => {
    it('deve cobrir fluxo de validação de documento do paciente', () => {
      const validator = service.documentPatientExistsValidator('123');
      (validator(new FormControl('')) as Observable<ValidationErrors | null>).subscribe(res => expect(res).toBeNull());
      (validator(new FormControl('123')) as Observable<ValidationErrors | null>).subscribe(res => expect(res).toBeNull());

      const control = new FormControl('456');
      (validator(control) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => expect(res).toEqual({ documentExists: true }));

      const req = httpMock.expectOne(`${mockValidatorUrl}/document-patient-exists/456/123`);
      req.flush({ documentExists: true });
    });
  });

  describe('documentEscortExistsValidator', () => {
    const mockPatientCare: PatientCare = { id: 10, patient: { cns: '123', document: 'CPF-TITULAR' } } as any;

    it('deve validar se o documento do acompanhante choca com o do titular', () => {
      const validator = service.documentEscortExistsValidator(mockPatientCare, 'OUTRO');
      
      (validator(new FormControl('CPF-TITULAR')) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => {
        expect(res).toEqual({ documentPatientExists: true });
      });

      const control = new FormControl('CPF-NOVO');
      (validator(control) as Observable<ValidationErrors | null>).subscribe((res: ValidationErrors | null) => expect(res).toEqual({ documentExists: true }));

      const req = httpMock.expectOne(`${mockValidatorUrl}/document-escort-exists/10/CPF-NOVO/OUTRO`);
      req.flush({ documentExists: true });
    });
  });

  // ==========================================
  // METODO PRIVADO mountFormData
  // ==========================================

  it('deve ignorar e retornar FormData vazio se o payload for nulo', () => {
    const formData = (service as any).mountFormData(null);
    expect(formData.has('any')).toBe(false);
  });
});