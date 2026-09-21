import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientRequest } from '../models/patient-request.model';
import { PatientRequestCostAssistance } from '../models/patient-request-cost-assistance.model';
import { CostAssistanceDaily } from '../models/cost-assistance-daily.model';
import { DailyCost } from '../models/daily-cost.model';
import { Professional } from '../models/professional.model';

@Injectable({
  providedIn: 'root',
})
export class PatientRequestCostAssistanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/cost-assistances`;

  // ==========================================
  // 1. CONSULTAS E LISTAGENS PRINCIPAIS
  // ==========================================

  getPatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests`);
  }

  getArchivePatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests/archived`);
  }

  getHistoryPatientRequests(reportId: number, patientRequestId: number): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests/${reportId}/${patientRequestId}/history`);
  }

  getBalance(patientCareId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/patient-cares/${patientCareId}/balance`);
  }

  // ==========================================
  // 2. OPERAÇÕES DE AJUDAS DE CUSTO (COST-ASSISTANCES)
  // ==========================================

  getCostAssistances(patientRequestId: number): Observable<PatientRequestCostAssistance[]> {
    return this.http.get<PatientRequestCostAssistance[]>(`${this.apiUrl}/patient-requests/${patientRequestId}`);
  }

  createCostAssistance(patientRequestId: number, data: PatientRequestCostAssistance): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}`, data);
  }

  updateCostAssistance(costAssistanceId: number, data: PatientRequestCostAssistance): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${costAssistanceId}`, data);
  }

  deleteCostAssistance(costAssistanceId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${costAssistanceId}`);
  }

  // ==========================================
  // 3. OPERAÇÕES DE DIÁRIAS (COST-ASSISTANCE-DAILIES)
  // ==========================================

  getCostAssistanceDailies(costAssistanceId: number): Observable<CostAssistanceDaily[]> {
    return this.http.get<CostAssistanceDaily[]>(`${this.apiUrl}/${costAssistanceId}/dailies`);
  }

  createCostAssistanceDaily(costAssistanceId: number, data: CostAssistanceDaily): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${costAssistanceId}/dailies`, data);
  }

  updateCostAssistanceDaily(costAssistanceDailyId: number, data: CostAssistanceDaily): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/dailies/${costAssistanceDailyId}`, data);
  }

  deleteCostAssistanceDaily(costAssistanceDailyId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/dailies/${costAssistanceDailyId}`);
  }

  // ==========================================
  // 4. TRAMITAÇÕES, PROCESSAMENTOS E FLUXO FINANCEIRO
  // ==========================================

  undoPatientRequest(patientRequestId: number, data: PatientRequest): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/undo`, data);
  }

  finishBackPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/finish-back`, {});
  }

  processPatientRequestToPayment(patientRequestId: number, data: any): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/process-to-payment`, data);
  }

  // ==========================================
  // 5. AÇÕES DE ESTADO, MOVIMENTAÇÕES E ARQUIVAMENTO
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

  movePatientRequestFromHistory(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-history`, {});
  }

  movePatientRequestFromOthers(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-others`, {});
  }

  // ==========================================
  // 6. CONSULTAS AUXILIARES
  // ==========================================

  getDailyCosts(): Observable<DailyCost[]> {
    return this.http.get<DailyCost[]>(`${this.apiUrl}/daily-costs`);
  }

  getPaymentProfessionals(): Observable<Professional[]> {
    return this.http.get<Professional[]>(`${this.apiUrl}/payment-professionals`);
  }
}