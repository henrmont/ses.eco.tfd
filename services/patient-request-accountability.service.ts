import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientRequest } from '../models/patient-request.model';
import { PatientRequestAccountability } from '../models/patient-request-accountability.model';
import { AccountabilityDaily } from '../models/accountability-daily.model';
import { DailyCost } from '../models/daily-cost.model';

@Injectable({
  providedIn: 'root',
})
export class PatientRequestAccountabilityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/accountabilities`;

  // ==========================================
  // 1. CONSULTAS E LISTAGENS PRINCIPAIS
  // ==========================================

  getPatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests`);
  }

  getArchivePatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests/archived`);
  }

  getBalance(patientCareId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/patient-cares/${patientCareId}/balance`);
  }

  // ==========================================
  // 2. OPERAÇÕES DE PRESTAÇÃO DE CONTAS (ACCOUNTABILITIES)
  // ==========================================

  getAccountabilities(patientRequestId: number): Observable<PatientRequestAccountability[]> {
    return this.http.get<PatientRequestAccountability[]>(`${this.apiUrl}/patient-requests/${patientRequestId}`);
  }

  createAccountability(patientRequestId: number, data: PatientRequestAccountability): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}`, data);
  }

  updateAccountability(accountabilityId: number, data: PatientRequestAccountability): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${accountabilityId}`, data);
  }

  deleteAccountability(accountabilityId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${accountabilityId}`);
  }

  // ==========================================
  // 3. OPERAÇÕES DE DIÁRIAS (ACCOUNTABILITY-DAILIES)
  // ==========================================

  getAccountabilityDailies(accountabilityId: number): Observable<AccountabilityDaily[]> {
    return this.http.get<AccountabilityDaily[]>(`${this.apiUrl}/${accountabilityId}/dailies`);
  }

  createAccountabilityDaily(accountabilityId: number, data: AccountabilityDaily): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${accountabilityId}/dailies`, data);
  }

  updateAccountabilityDaily(accountabilityDailyId: number, data: AccountabilityDaily): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/dailies/${accountabilityDailyId}`, data);
  }

  deleteAccountabilityDaily(accountabilityDailyId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/dailies/${accountabilityDailyId}`);
  }

  // ==========================================
  // 4. AÇÕES DE ESTADO, MOVIMENTAÇÕES E ARQUIVAMENTO
  // ==========================================

  haltedPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/halted`, {});
  }

  archivePatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/archive`, {});
  }

  movePatientRequestFromArchive(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-archive`, {});
  }

  movePatientRequestFromOthers(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-others`, {});
  }

  // ==========================================
  // 5. CONSULTAS AUXILIARES
  // ==========================================

  getDailyCosts(): Observable<DailyCost[]> {
    return this.http.get<DailyCost[]>(`${this.apiUrl}/daily-costs`);
  }
}