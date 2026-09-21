import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientRequestOpinion } from '../models/patient-request-opinion.model';
import { PatientRequest } from '../models/patient-request.model';
import { Professional } from '../models/professional.model';

@Injectable({
  providedIn: 'root',
})
export class PatientRequestOpinionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/opinions`;

  // ==========================================
  // 1. CONSULTAS E LISTAGENS PRINCIPAIS
  // ==========================================

  getPatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests`);
  }

  getArchivePatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests/archived`);
  }

  getType(): Observable<string> {
    return this.http.get<string>(`${this.apiUrl}/professional-type`);
  }

  getHistoryPatientRequests(reportId: number, patientRequestId: number): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/reports/${reportId}/patient-requests/${patientRequestId}/history`);
  }

  // ==========================================
  // 2. OPERAÇÕES DO PARECER (CRUD)
  // ==========================================

  getOpinions(patientRequestId: number): Observable<PatientRequestOpinion[]> {
    return this.http.get<PatientRequestOpinion[]>(`${this.apiUrl}/patient-requests/${patientRequestId}`);
  }

  createOpinion(patientRequestId: number, data: PatientRequestOpinion): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}`, data);
  }

  updateOpinion(opinionId: number, data: PatientRequestOpinion): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${opinionId}`, data);
  }

  deleteOpinion(opinionId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${opinionId}`);
  }

  // ==========================================
  // 3. TRAMITAÇÕES E PROCESSAMENTOS
  // ==========================================

  processPatientRequestToSocial(patientRequestId: number, data: Partial<PatientRequest>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/process-to-social`, data);
  }

  processPatientRequestToCostAssistanceAndTravel(patientRequestId: number, data: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/process-to-cost-and-travel`, data);
  }

  undoPatientRequest(patientRequestId: number, data: Record<string, unknown>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/undo`, data);
  }

  finishBackPatientRequest(type: string, patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/finish-back/${type}`, {});
  }

  // ==========================================
  // 4. AÇÕES DE ESTADO, MOVIMENTAÇÕES E ARQUIVAMENTO
  // ==========================================

  archivePatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/archive`, {});
  }

  haltedPatientRequest(type: string, patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/halted/${type}`, {});
  }

  movePatientRequestFromProcesses(type: string, patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-processes/${type}`, {});
  }

  movePatientRequestFromArchive(type: string, patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-archive/${type}`, {});
  }

  movePatientRequestFromOthers(type: string, patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-others/${type}`, {});
  }

  // ==========================================
  // 5. CONSULTAS DE PROFISSIONAIS AUXILIARES
  // ==========================================

  getSocialProfessionals(): Observable<Professional[]> {
    return this.http.get<Professional[]>(`${this.apiUrl}/social-professionals`);
  }

  getCostAssistanceProfessionals(): Observable<Professional[]> {
    return this.http.get<Professional[]>(`${this.apiUrl}/cost-assistance-professionals`);
  }

  getTravelProfessionals(): Observable<Professional[]> {
    return this.http.get<Professional[]>(`${this.apiUrl}/travel-professionals`);
  }
}