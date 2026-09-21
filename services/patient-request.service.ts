import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import * as moment from 'moment';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { HospitalUnity } from '../models/hospital-unity.model';
import { PatientReport } from '../models/patient-report.model';
import { PatientRequestAttachment } from '../models/patient-request-attachment.model';
import { PatientRequest } from '../models/patient-request.model';
import { Patient } from '../models/patient.model';
import { Professional } from '../models/professional.model';

@Injectable({
  providedIn: 'root',
})
export class PatientRequestService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/patient-requests`;

  // ==========================================
  // 1. FLUXO DE SOLICITAÇÕES
  // ==========================================

  getPatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}`);
  }

  createPatientRequest(data: PatientRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}`, data);
  }

  updatePatientRequest(patientRequestId: number, data: PatientRequest): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}`, data);
  }

  deletePatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientRequestId}`);
  }

  // ==========================================
  // 2. AÇÕES DE ESTADO E MOVIMENTAÇÕES
  // ==========================================

  haltedPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/halted`, {});
  }

  processPatientRequestToMedical(patientRequestId: number, data: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/process-to-medical`, data);
  }

  movePatientRequestFromProcesses(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/move-from-processes`, {});
  }

  movePatientRequestFromOthers(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/move-from-others`, {});
  }

  movePatientRequestFromArchive(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/move-from-archive`, {});
  }

  finishBackPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientRequestId}/finish-back`, {});
  }

  // ==========================================
  // 3. FLUXO DE ANEXOS DA SOLICITAÇÃO
  // ==========================================

  getPatientRequestAttachments(patientRequestId: number): Observable<PatientRequestAttachment[]> {
    return this.http.get<PatientRequestAttachment[]>(`${this.apiUrl}/${patientRequestId}/attachments`);
  }

  createPatientRequestAttachment(patientRequestId: number, data: PatientRequestAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientRequestId}/attachments`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  updatePatientRequestAttachment(patientRequestAttachmentId: number, data: PatientRequestAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/attachments/${patientRequestAttachmentId}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  deletePatientRequestAttachment(patientRequestAttachmentId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/attachments/${patientRequestAttachmentId}`);
  }

  // ==========================================
  // 4. CONSULTAS E DADOS AUXILIARES
  // ==========================================

  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiUrl}/patients`);
  }

  getReports(patientCareId: number): Observable<PatientReport[]> {
    return this.http.get<PatientReport[]>(`${this.apiUrl}/patients/${patientCareId}/reports`);
  }

  getHospitalUnities(): Observable<HospitalUnity[]> {
    return this.http.get<HospitalUnity[]>(`${this.apiUrl}/hospital-unities`);
  }

  getMedicalProfessionals(): Observable<Professional[]> {
    return this.http.get<Professional[]>(`${this.apiUrl}/medical-professionals`);
  }

  // ==========================================
  // 5. MÉTODOS AUXILIARES PRIVADOS
  // ==========================================

  private mountFormData(data: Record<string, unknown>): FormData {
    const formData = new FormData();

    if (!data) return formData;

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value);
      } else if (moment.isMoment(value)) {
        formData.append(key, value.format('YYYY-MM-DD'));
      } else if (typeof value === 'boolean') {
        formData.append(key, value ? '1' : '0');
      } else {
        formData.append(key, String(value));
      }
    }

    return formData;
  }
}