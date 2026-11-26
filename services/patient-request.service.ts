import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { HospitalUnity } from '../models/hospital-unity.model';
import { PatientReport } from '../models/patient-report.model';
import { PatientRequestAttachment } from '../models/patient-request-attachment.model';
import { PatientRequest } from '../models/patient-request.model';
import { Patient } from '../models/patient.model';
import { Professional } from '../models/professional.model';

interface MomentLike {
  format(pattern: string): string;
}

@Injectable({
  providedIn: 'root',
})
export class PatientRequestService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/patient-requests`;

  // ==========================================
  // Consultas (GET)
  // ==========================================
  getPatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(this.apiUrl);
  }

  getArchivePatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/archived`);
  }

  getPatientRequestAttachments(patientRequestId: number): Observable<PatientRequestAttachment[]> {
    return this.http.get<PatientRequestAttachment[]>(`${this.apiUrl}/${patientRequestId}/attachments`);
  }

  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiUrl}/patients`);
  }

  getReports(patientCareId: number): Observable<PatientReport[]> {
    return this.http.get<PatientReport[]>(`${this.apiUrl}/patients/${patientCareId}/reports`);
  }

  getHospitalUnities(): Observable<HospitalUnity[]> {
    return this.http.get<HospitalUnity[]>(`${this.apiUrl}/hospital-unities`);
  }

  getProfessionals(): Observable<Professional[]> {
    return this.http.get<Professional[]>(`${this.apiUrl}/professionals`);
  }

  // ==========================================
  // Operações de Escrita / CRUD
  // ==========================================
  createPatientRequest(data: PatientRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.apiUrl, data);
  }

  updatePatientRequest(patientRequestId: number, data: PatientRequest): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${patientRequestId}`, data);
  }

  deletePatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientRequestId}`);
  }

  createPatientRequestAttachment(
    patientRequestId: number,
    data: PatientRequestAttachment
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/${patientRequestId}/attachments`,
      this.mountFormData(data)
    );
  }

  updatePatientRequestAttachment(
    patientRequestAttachmentId: number,
    data: PatientRequestAttachment
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/attachments/${patientRequestAttachmentId}`,
      this.mountFormData(data, 'PUT')
    );
  }

  deletePatientRequestAttachment(patientRequestAttachmentId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/attachments/${patientRequestAttachmentId}`);
  }

  // ==========================================
  // Ações de Estado e Movimentações
  // ==========================================
  haltedPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/halted`, {});
  }

  archivePatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/archive`, {});
  }

  processPatientRequest(
    patientRequestId: number,
    data: Record<string, unknown>
  ): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/process`, data);
  }

  movePatientRequestFromProcesses(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(
      `${this.apiUrl}/${patientRequestId}/move-from-processes`,
      {}
    );
  }

  movePatientRequestFromOthers(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/move-from-others`, {});
  }

  movePatientRequestFromArchive(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/move-from-archive`, {});
  }

  undoPatientRequest(
    patientRequestId: number,
    data: Record<string, unknown>
  ): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/undo`, data);
  }

  finishBackPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/finish-back`, {});
  }

  // ==========================================
  // Métodos Auxiliares Privados
  // ==========================================
  private mountFormData(data: object, method?: 'PUT' | 'PATCH'): FormData {
    const formData = new FormData();

    if (method) {
      formData.append('_method', method);
    }

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else if (this.isMomentLike(value)) {
        formData.append(key, value.format('YYYY-MM-DD'));
      } else if (value instanceof Date) {
        formData.append(key, value.toISOString().split('T')[0]);
      } else if (typeof value === 'boolean') {
        formData.append(key, value ? '1' : '0');
      } else {
        formData.append(key, String(value));
      }
    }

    return formData;
  }

  private isMomentLike(value: unknown): value is MomentLike {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as MomentLike).format === 'function'
    );
  }
}