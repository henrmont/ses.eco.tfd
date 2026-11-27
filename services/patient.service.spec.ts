// src/app/tfd/services/patient.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormControl, ValidationErrors } from '@angular/forms';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientService } from './patient.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientCare } from '../models/patient-care.model';
import { PatientEscort } from '../models/patient-escort.model';
import { PatientReport } from '../models/patient-report.model';
import { Patient } from '../models/patient.model';
import { ReportAttachment } from '../models/report-attachment.model';

function observeValidation(
  result: Observable<ValidationErrors | null> | Promise<ValidationErrors | null>,
  onNext: (value: ValidationErrors | null) => void
): void {
  if (!(result instanceof Observable)) {
    throw new Error('Expected validator to return an Observable');
  }
  result.subscribe((value: ValidationErrors | null) => onNext(value));
}

describe('Tfd PatientService', () => {
  let service: PatientService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiTfdUrl}/patients`;

  const mockPatient = {
    id: 10,
    name: 'Carlos Silva',
    cns: '123456789012345',
    document: '12345678901',
    exists_in_tfd: true,
  } as unknown as Patient & { exists_in_tfd?: boolean };

  const mockEscort = {
    id: 20,
    name: 'Ana Silva',
    cns: '987654321098765',
    document: '98765432109',
  } as unknown as PatientEscort;

  const mockPatientCare = {
    id: 5,
    patient: mockPatient,
    escorts: [mockEscort],
  } as unknown as PatientCare;

  const mockReport = { id: 30, title: 'Laudo Médico' } as unknown as PatientReport;
  const mockAttachment = { id: 40, name: 'exame.pdf' } as unknown as ReportAttachment;
  const mockCids = [{ id: 1, code: 'I10', description: 'Hipertensão' }];
  const mockApiResponse = { message: 'OK' } as unknown as ApiResponse;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PatientService],
    });

    service = TestBed.inject(PatientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  it('deve consultar endpoints GET de pacientes, acompanhantes, laudos, CIDs e anexos', () => {
    let patientsRes: PatientCare[] | undefined;
    let archivedRes: PatientCare[] | undefined;
    let escortsRes: PatientEscort[] | undefined;
    let reportsRes: PatientReport[] | undefined;
    let cidsRes: unknown;
    let attachmentsRes: ReportAttachment[] | undefined;

    service.getPatients().subscribe((res) => (patientsRes = res));
    service.getArchivePatients().subscribe((res) => (archivedRes = res));
    service.getPatientEscorts(5).subscribe((res) => (escortsRes = res));
    service.getPatientReports(5).subscribe((res) => (reportsRes = res));
    service.getCids(5).subscribe((res) => (cidsRes = res));
    service.getReportAttachments(5, 30).subscribe((res) => (attachmentsRes = res));

    const r1 = httpMock.expectOne(baseUrl);
    expect(r1.request.method).toBe('GET');
    r1.flush([mockPatientCare]);

    const r2 = httpMock.expectOne(`${baseUrl}/archived`);
    expect(r2.request.method).toBe('GET');
    r2.flush([mockPatientCare]);

    const r3 = httpMock.expectOne(`${baseUrl}/5/escorts`);
    expect(r3.request.method).toBe('GET');
    r3.flush([mockEscort]);

    const r4 = httpMock.expectOne(`${baseUrl}/5/reports`);
    expect(r4.request.method).toBe('GET');
    r4.flush([mockReport]);

    const r5 = httpMock.expectOne(`${baseUrl}/5/cids`);
    expect(r5.request.method).toBe('GET');
    r5.flush(mockCids);

    const r6 = httpMock.expectOne(`${baseUrl}/5/reports/30/attachments`);
    expect(r6.request.method).toBe('GET');
    r6.flush([mockAttachment]);

    expect(patientsRes).toEqual([mockPatientCare]);
    expect(archivedRes).toEqual([mockPatientCare]);
    expect(escortsRes).toEqual([mockEscort]);
    expect(reportsRes).toEqual([mockReport]);
    expect(cidsRes).toEqual(mockCids);
    expect(attachmentsRes).toEqual([mockAttachment]);
  });

  it('deve criar e atualizar paciente montando FormData com diferentes tipos de valores', () => {
    const file = new File(['conteudo'], 'documento.pdf', { type: 'application/pdf' });
    const momentLike = { format: (pattern: string) => (pattern === 'YYYY-MM-DD' ? '2026-05-10' : '') };
    const dateObj = new Date('2026-06-15T12:00:00.000Z');

    const payload = {
      name: 'João',
      active: true,
      inactive: false,
      birthMoment: momentLike,
      travelDate: dateObj,
      docFile: file,
      ignoredNull: null,
      ignoredUndefined: undefined,
    } as unknown as Patient;

    let createRes: ApiResponse | undefined;
    let updateRes: ApiResponse | undefined;

    service.createPatient(payload).subscribe((res) => (createRes = res));
    service.updatePatient(5, payload).subscribe((res) => (updateRes = res));

    const postReq = httpMock.expectOne(baseUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toBeInstanceOf(FormData);
    const postForm = postReq.request.body as FormData;
    expect(postForm.get('_method')).toBeNull();
    expect(postForm.get('name')).toBe('João');
    expect(postForm.get('active')).toBe('1');
    expect(postForm.get('inactive')).toBe('0');
    expect(postForm.get('birthMoment')).toBe('2026-05-10');
    expect(postForm.get('travelDate')).toBe('2026-06-15');
    expect(postForm.get('docFile')).toBe(file);
    expect(postForm.has('ignoredNull')).toBe(false);
    expect(postForm.has('ignoredUndefined')).toBe(false);
    postReq.flush(mockApiResponse);

    const putViaPostReq = httpMock.expectOne(`${baseUrl}/5`);
    expect(putViaPostReq.request.method).toBe('POST');
    expect(putViaPostReq.request.body).toBeInstanceOf(FormData);
    expect((putViaPostReq.request.body as FormData).get('_method')).toBe('PUT');
    putViaPostReq.flush(mockApiResponse);

    expect(createRes).toEqual(mockApiResponse);
    expect(updateRes).toEqual(mockApiResponse);
  });

  it('deve executar ações PATCH de estado do paciente', () => {
    const responses: ApiResponse[] = [];

    service.archivePatient(5).subscribe((res) => responses.push(res));
    service.movePatientFromArchive(5).subscribe((res) => responses.push(res));
    service.movePatientFromOthers(5).subscribe((res) => responses.push(res));
    service.validatePatient(5).subscribe((res) => responses.push(res));
    service.finishBackPatient(5).subscribe((res) => responses.push(res));

    const archiveReq = httpMock.expectOne(`${baseUrl}/5/archive`);
    expect(archiveReq.request.method).toBe('PATCH');
    expect(archiveReq.request.body).toEqual({});
    archiveReq.flush(mockApiResponse);

    const fromArchiveReq = httpMock.expectOne(`${baseUrl}/5/move-from-archive`);
    expect(fromArchiveReq.request.method).toBe('PATCH');
    expect(fromArchiveReq.request.body).toEqual({});
    fromArchiveReq.flush(mockApiResponse);

    const fromOthersReq = httpMock.expectOne(`${baseUrl}/5/move-from-others`);
    expect(fromOthersReq.request.method).toBe('PATCH');
    expect(fromOthersReq.request.body).toEqual({});
    fromOthersReq.flush(mockApiResponse);

    const validateReq = httpMock.expectOne(`${baseUrl}/5/validate`);
    expect(validateReq.request.method).toBe('PATCH');
    expect(validateReq.request.body).toEqual({});
    validateReq.flush(mockApiResponse);

    const finishReq = httpMock.expectOne(`${baseUrl}/5/finish-back`);
    expect(finishReq.request.method).toBe('PATCH');
    expect(finishReq.request.body).toEqual({});
    finishReq.flush(mockApiResponse);

    expect(responses).toHaveLength(5);
  });

  it('deve gerenciar acompanhantes, laudos e anexos (criar, atualizar e excluir)', () => {
    const results: ApiResponse[] = [];

    service.createPatientEscort(5, mockEscort).subscribe((res) => results.push(res));
    service.updatePatientEscort(5, 20, mockEscort).subscribe((res) => results.push(res));
    service.deletePatientEscort(5, 20).subscribe((res) => results.push(res));

    service.createPatientReport(5, mockReport).subscribe((res) => results.push(res));
    service.updatePatientReport(5, 30, mockReport).subscribe((res) => results.push(res));
    service.deletePatientReport(5, 30).subscribe((res) => results.push(res));

    service.createReportAttachment(5, 30, mockAttachment).subscribe((res) => results.push(res));
    service.updateReportAttachment(5, 30, 40, mockAttachment).subscribe((res) => results.push(res));
    service.deleteReportAttachment(5, 30, 40).subscribe((res) => results.push(res));

    const createEscortReq = httpMock.expectOne(`${baseUrl}/5/escorts`);
    expect(createEscortReq.request.method).toBe('POST');
    expect(createEscortReq.request.body).toBeInstanceOf(FormData);
    createEscortReq.flush(mockApiResponse);

    const escortIdReqs = httpMock.match(`${baseUrl}/5/escorts/20`);
    expect(escortIdReqs).toHaveLength(2);
    const updateEscortReq = escortIdReqs.find((r) => r.request.method === 'POST');
    const deleteEscortReq = escortIdReqs.find((r) => r.request.method === 'DELETE');
    expect((updateEscortReq!.request.body as FormData).get('_method')).toBe('PUT');
    updateEscortReq!.flush(mockApiResponse);
    deleteEscortReq!.flush(mockApiResponse);

    const createReportReq = httpMock.expectOne(`${baseUrl}/5/reports`);
    expect(createReportReq.request.method).toBe('POST');
    expect(createReportReq.request.body).toEqual(mockReport);
    createReportReq.flush(mockApiResponse);

    const reportIdReqs = httpMock.match(`${baseUrl}/5/reports/30`);
    expect(reportIdReqs).toHaveLength(2);
    const updateReportReq = reportIdReqs.find((r) => r.request.method === 'PUT');
    const deleteReportReq = reportIdReqs.find((r) => r.request.method === 'DELETE');
    expect(updateReportReq!.request.body).toEqual(mockReport);
    updateReportReq!.flush(mockApiResponse);
    deleteReportReq!.flush(mockApiResponse);

    const createAttReq = httpMock.expectOne(`${baseUrl}/5/reports/30/attachments`);
    expect(createAttReq.request.method).toBe('POST');
    expect(createAttReq.request.body).toBeInstanceOf(FormData);
    createAttReq.flush(mockApiResponse);

    const attIdReqs = httpMock.match(`${baseUrl}/5/reports/30/attachments/40`);
    expect(attIdReqs).toHaveLength(2);
    const updateAttReq = attIdReqs.find((r) => r.request.method === 'POST');
    const deleteAttReq = attIdReqs.find((r) => r.request.method === 'DELETE');
    expect((updateAttReq!.request.body as FormData).get('_method')).toBe('PUT');
    updateAttReq!.flush(mockApiResponse);
    deleteAttReq!.flush(mockApiResponse);

    expect(results).toHaveLength(9);
  });

  it('deve buscar paciente e acompanhante por CNS ou documento limpando dígitos e tratando erro com null', () => {
    let foundPatientCns: unknown;
    let errPatientDoc: unknown;
    let foundEscortCns: unknown;
    let errEscortDoc: unknown;

    service.getPatientCns('123.4567.8901-2345').subscribe((res) => (foundPatientCns = res));
    service.getPatientDocument('123.456.789-01').subscribe((res) => (errPatientDoc = res));
    service.getEscortCns('987.6543.2109-8765').subscribe((res) => (foundEscortCns = res));
    service.getEscortDocument('987.654.321-09').subscribe((res) => (errEscortDoc = res));

    const pCnsReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/search` && r.params.get('cns') === '123456789012345'
    );
    pCnsReq.flush(mockPatient);

    const pDocReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/search` && r.params.get('document') === '12345678901'
    );
    pDocReq.flush('Erro', { status: 404, statusText: 'Not Found' });

    const eCnsReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/escorts/search` && r.params.get('cns') === '987654321098765'
    );
    eCnsReq.flush(mockEscort);

    const eDocReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/escorts/search` && r.params.get('document') === '98765432109'
    );
    eDocReq.flush('Erro', { status: 500, statusText: 'Server Error' });

    expect(foundPatientCns).toEqual(mockPatient);
    expect(errPatientDoc).toBeNull();
    expect(foundEscortCns).toEqual(mockEscort);
    expect(errEscortDoc).toBeNull();
  });

  it('deve validar CNS e documento de paciente de forma assíncrona com debounce e callback onFound', async () => {
    vi.useFakeTimers();
    const onFoundPatient = vi.fn();
    const cnsValidator = service.cnsPatientExistsValidator('111111111111111', onFoundPatient);

    const pristineCtrl = new FormControl('123456789012345');
    let pristineRes: ValidationErrors | null | string = 'pending';
    observeValidation(cnsValidator(pristineCtrl), (v) => (pristineRes = v));
    await vi.advanceTimersByTimeAsync(400);
    expect(pristineRes).toBeNull();

    const dirtyCtrl = new FormControl('123.4567.8901-2345');
    dirtyCtrl.markAsDirty();
    let cnsValidationRes: ValidationErrors | null | string = 'pending';
    observeValidation(cnsValidator(dirtyCtrl), (v) => (cnsValidationRes = v));

    await vi.advanceTimersByTimeAsync(399);
    httpMock.expectNone(`${baseUrl}/search`);
    await vi.advanceTimersByTimeAsync(1);

    const cnsReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/search` && r.params.get('cns') === '123456789012345'
    );
    cnsReq.flush({ ...mockPatient, exists_in_tfd: true });
    expect(onFoundPatient).toHaveBeenCalledTimes(1);
    expect(cnsValidationRes).toEqual({ cnsExists: true });

    const docValidator = service.documentPatientExistsValidator();
    const docCtrl = new FormControl('123.456.789-01');
    docCtrl.markAsDirty();
    let docValidationRes: ValidationErrors | null | string = 'pending';
    observeValidation(docValidator(docCtrl), (v) => (docValidationRes = v));
    await vi.advanceTimersByTimeAsync(400);

    const docReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/search` && r.params.get('document') === '12345678901'
    );
    docReq.flush({ ...mockPatient, exists_in_tfd: false });
    expect(docValidationRes).toBeNull();
  });

  it('deve validar CNS e documento de acompanhante (mesmo paciente, no atendimento e fora do atendimento)', async () => {
    vi.useFakeTimers();

    const escortCnsValidator = service.cnsEscortExistsValidator(mockPatientCare);

    const sameAsPatientCns = new FormControl('123456789012345');
    sameAsPatientCns.markAsDirty();
    let samePatientRes: ValidationErrors | null | string = 'pending';
    observeValidation(escortCnsValidator(sameAsPatientCns), (v) => (samePatientRes = v));
    await vi.advanceTimersByTimeAsync(400);
    expect(samePatientRes).toEqual({ cnsPatientExists: true });

    const inCareCns = new FormControl('987654321098765');
    inCareCns.markAsDirty();
    let inCareRes: ValidationErrors | null | string = 'pending';
    observeValidation(escortCnsValidator(inCareCns), (v) => (inCareRes = v));
    await vi.advanceTimersByTimeAsync(400);

    const cnsReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/escorts/search` && r.params.get('cns') === '987654321098765'
    );
    cnsReq.flush(mockEscort);
    expect(inCareRes).toEqual({ cnsExists: true });

    const escortDocWithoutCare = service.documentEscortExistsValidator(null);
    const otherDocCtrl = new FormControl('555.666.777-88');
    otherDocCtrl.markAsDirty();
    let otherDocRes: ValidationErrors | null | string = 'pending';
    observeValidation(escortDocWithoutCare(otherDocCtrl), (v) => (otherDocRes = v));
    await vi.advanceTimersByTimeAsync(400);

    const docReq = httpMock.expectOne(
      (r) => r.url === `${baseUrl}/escorts/search` && r.params.get('document') === '55566677788'
    );
    docReq.flush({ id: 99, document: '55566677788' });
    expect(otherDocRes).toEqual({ documentExists: true });
  });
});