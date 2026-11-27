// src/app/tfd/services/patient-request.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PatientRequestService } from './patient-request.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { HospitalUnity } from '../models/hospital-unity.model';
import { PatientReport } from '../models/patient-report.model';
import { PatientRequestAttachment } from '../models/patient-request-attachment.model';
import { PatientRequest } from '../models/patient-request.model';
import { Patient } from '../models/patient.model';
import { Professional } from '../models/professional.model';

describe('Tfd PatientRequestService', () => {
  let service: PatientRequestService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiTfdUrl}/patient-requests`;

  const mockRequest = { id: 12, status: 'pending' } as unknown as PatientRequest;
  const mockAttachment = { id: 34, name: 'laudo.pdf' } as unknown as PatientRequestAttachment;
  const mockPatient = { id: 56, name: 'José Santos' } as unknown as Patient;
  const mockReport = { id: 78, title: 'Relatório Clínico' } as unknown as PatientReport;
  const mockUnity = { id: 90, name: 'Hospital Central' } as unknown as HospitalUnity;
  const mockProfessional = { id: 101, name: 'Dra. Helena' } as unknown as Professional;
  const mockApiResponse = { message: 'OK' } as unknown as ApiResponse;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PatientRequestService],
    });

    service = TestBed.inject(PatientRequestService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve consultar todos os endpoints GET de solicitações, anexos, pacientes, laudos, unidades e profissionais', () => {
    let requestsRes: PatientRequest[] | undefined;
    let archivedRes: PatientRequest[] | undefined;
    let attachmentsRes: PatientRequestAttachment[] | undefined;
    let patientsRes: Patient[] | undefined;
    let reportsRes: PatientReport[] | undefined;
    let unitiesRes: HospitalUnity[] | undefined;
    let professionalsRes: Professional[] | undefined;

    service.getPatientRequests().subscribe((res) => (requestsRes = res));
    service.getArchivePatientRequests().subscribe((res) => (archivedRes = res));
    service.getPatientRequestAttachments(12).subscribe((res) => (attachmentsRes = res));
    service.getPatients().subscribe((res) => (patientsRes = res));
    service.getReports(56).subscribe((res) => (reportsRes = res));
    service.getHospitalUnities().subscribe((res) => (unitiesRes = res));
    service.getProfessionals().subscribe((res) => (professionalsRes = res));

    const r1 = httpMock.expectOne(baseUrl);
    expect(r1.request.method).toBe('GET');
    r1.flush([mockRequest]);

    const r2 = httpMock.expectOne(`${baseUrl}/archived`);
    expect(r2.request.method).toBe('GET');
    r2.flush([mockRequest]);

    const r3 = httpMock.expectOne(`${baseUrl}/12/attachments`);
    expect(r3.request.method).toBe('GET');
    r3.flush([mockAttachment]);

    const r4 = httpMock.expectOne(`${baseUrl}/patients`);
    expect(r4.request.method).toBe('GET');
    r4.flush([mockPatient]);

    const r5 = httpMock.expectOne(`${baseUrl}/patients/56/reports`);
    expect(r5.request.method).toBe('GET');
    r5.flush([mockReport]);

    const r6 = httpMock.expectOne(`${baseUrl}/hospital-unities`);
    expect(r6.request.method).toBe('GET');
    r6.flush([mockUnity]);

    const r7 = httpMock.expectOne(`${baseUrl}/professionals`);
    expect(r7.request.method).toBe('GET');
    r7.flush([mockProfessional]);

    expect(requestsRes).toEqual([mockRequest]);
    expect(archivedRes).toEqual([mockRequest]);
    expect(attachmentsRes).toEqual([mockAttachment]);
    expect(patientsRes).toEqual([mockPatient]);
    expect(reportsRes).toEqual([mockReport]);
    expect(unitiesRes).toEqual([mockUnity]);
    expect(professionalsRes).toEqual([mockProfessional]);
  });

  it('deve executar createPatientRequest, updatePatientRequest e deletePatientRequest', () => {
    let createRes: ApiResponse | undefined;
    let updateRes: ApiResponse | undefined;
    let deleteRes: ApiResponse | undefined;

    service.createPatientRequest(mockRequest).subscribe((res) => (createRes = res));
    service.updatePatientRequest(12, mockRequest).subscribe((res) => (updateRes = res));
    service.deletePatientRequest(12).subscribe((res) => (deleteRes = res));

    const postReq = httpMock.expectOne(baseUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual(mockRequest);
    postReq.flush(mockApiResponse);

    const idReqs = httpMock.match(`${baseUrl}/12`);
    expect(idReqs).toHaveLength(2);

    const putReq = idReqs.find((r) => r.request.method === 'PUT');
    const deleteReq = idReqs.find((r) => r.request.method === 'DELETE');

    expect(putReq).toBeDefined();
    expect(putReq!.request.body).toEqual(mockRequest);
    putReq!.flush(mockApiResponse);

    expect(deleteReq).toBeDefined();
    deleteReq!.flush(mockApiResponse);

    expect(createRes).toEqual(mockApiResponse);
    expect(updateRes).toEqual(mockApiResponse);
    expect(deleteRes).toEqual(mockApiResponse);
  });

  it('deve criar, atualizar (com FormData e _method=PUT) e excluir anexos de solicitação', () => {
    const file = new File(['conteudo'], 'anexo.pdf', { type: 'application/pdf' });
    const momentLike = {
      format: (pattern: string) => (pattern === 'YYYY-MM-DD' ? '2026-08-20' : ''),
    };
    const dateObj = new Date('2026-09-10T12:00:00.000Z');

    const richAttachment = {
      title: 'Exame',
      active: true,
      archived: false,
      issueMoment: momentLike,
      examDate: dateObj,
      file,
      emptyNull: null,
      emptyUndefined: undefined,
    } as unknown as PatientRequestAttachment;

    let createRes: ApiResponse | undefined;
    let updateRes: ApiResponse | undefined;
    let deleteRes: ApiResponse | undefined;

    service
      .createPatientRequestAttachment(12, mockAttachment)
      .subscribe((res) => (createRes = res));
    service
      .updatePatientRequestAttachment(34, richAttachment)
      .subscribe((res) => (updateRes = res));
    service.deletePatientRequestAttachment(34).subscribe((res) => (deleteRes = res));

    const createReq = httpMock.expectOne(`${baseUrl}/12/attachments`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toBeInstanceOf(FormData);
    expect((createReq.request.body as FormData).get('_method')).toBeNull();
    createReq.flush(mockApiResponse);

    const attReqs = httpMock.match(`${baseUrl}/attachments/34`);
    expect(attReqs).toHaveLength(2);

    const updateReq = attReqs.find((r) => r.request.method === 'POST');
    const deleteReq = attReqs.find((r) => r.request.method === 'DELETE');

    expect(updateReq).toBeDefined();
    expect(updateReq!.request.body).toBeInstanceOf(FormData);
    const formData = updateReq!.request.body as FormData;
    expect(formData.get('_method')).toBe('PUT');
    expect(formData.get('title')).toBe('Exame');
    expect(formData.get('active')).toBe('1');
    expect(formData.get('archived')).toBe('0');
    expect(formData.get('issueMoment')).toBe('2026-08-20');
    expect(formData.get('examDate')).toBe('2026-09-10');
    expect(formData.get('file')).toBe(file);
    expect(formData.has('emptyNull')).toBe(false);
    expect(formData.has('emptyUndefined')).toBe(false);
    updateReq!.flush(mockApiResponse);

    expect(deleteReq).toBeDefined();
    deleteReq!.flush(mockApiResponse);

    expect(createRes).toEqual(mockApiResponse);
    expect(updateRes).toEqual(mockApiResponse);
    expect(deleteRes).toEqual(mockApiResponse);
  });

  it('deve executar todas as ações PATCH de estado e movimentação da solicitação', () => {
    const results: ApiResponse[] = [];
    const processPayload = { hospital_unity_id: 90 };
    const undoPayload = { reason: 'Correção de fluxo' };

    service.haltedPatientRequest(12).subscribe((res) => results.push(res));
    service.archivePatientRequest(12).subscribe((res) => results.push(res));
    service.processPatientRequest(12, processPayload).subscribe((res) => results.push(res));
    service.movePatientRequestFromProcesses(12).subscribe((res) => results.push(res));
    service.movePatientRequestFromOthers(12).subscribe((res) => results.push(res));
    service.movePatientRequestFromArchive(12).subscribe((res) => results.push(res));
    service.undoPatientRequest(12, undoPayload).subscribe((res) => results.push(res));
    service.finishBackPatientRequest(12).subscribe((res) => results.push(res));

    const haltedReq = httpMock.expectOne(`${baseUrl}/12/halted`);
    expect(haltedReq.request.method).toBe('PATCH');
    expect(haltedReq.request.body).toEqual({});
    haltedReq.flush(mockApiResponse);

    const archiveReq = httpMock.expectOne(`${baseUrl}/12/archive`);
    expect(archiveReq.request.method).toBe('PATCH');
    expect(archiveReq.request.body).toEqual({});
    archiveReq.flush(mockApiResponse);

    const processReq = httpMock.expectOne(`${baseUrl}/12/process`);
    expect(processReq.request.method).toBe('PATCH');
    expect(processReq.request.body).toEqual(processPayload);
    processReq.flush(mockApiResponse);

    const fromProcessesReq = httpMock.expectOne(`${baseUrl}/12/move-from-processes`);
    expect(fromProcessesReq.request.method).toBe('PATCH');
    expect(fromProcessesReq.request.body).toEqual({});
    fromProcessesReq.flush(mockApiResponse);

    const fromOthersReq = httpMock.expectOne(`${baseUrl}/12/move-from-others`);
    expect(fromOthersReq.request.method).toBe('PATCH');
    expect(fromOthersReq.request.body).toEqual({});
    fromOthersReq.flush(mockApiResponse);

    const fromArchiveReq = httpMock.expectOne(`${baseUrl}/12/move-from-archive`);
    expect(fromArchiveReq.request.method).toBe('PATCH');
    expect(fromArchiveReq.request.body).toEqual({});
    fromArchiveReq.flush(mockApiResponse);

    const undoReq = httpMock.expectOne(`${baseUrl}/12/undo`);
    expect(undoReq.request.method).toBe('PATCH');
    expect(undoReq.request.body).toEqual(undoPayload);
    undoReq.flush(mockApiResponse);

    const finishBackReq = httpMock.expectOne(`${baseUrl}/12/finish-back`);
    expect(finishBackReq.request.method).toBe('PATCH');
    expect(finishBackReq.request.body).toEqual({});
    finishBackReq.flush(mockApiResponse);

    expect(results).toHaveLength(8);
  });
});