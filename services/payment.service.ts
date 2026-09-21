import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientRequest } from '../models/patient-request.model';
import { Payment } from '../models/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/payments`;

  // ==========================================
  // 1. CONSULTAS E LISTAGENS PRINCIPAIS
  // ==========================================

  getPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}`);
  }

  getArchivePayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}/archived`);
  }

  // ==========================================
  // 2. EDIÇÃO E ATUALIZAÇÃO
  // ==========================================

  updatePayment(paymentId: number, data: any): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${paymentId}`, data);
  }

  // ==========================================
  // 3. AÇÕES DE ESTADO, MOVIMENTAÇÕES E ARQUIVAMENTO
  // ==========================================

  haltedPayment(paymentId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${paymentId}/halted`, {});
  }

  archivePayment(paymentId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${paymentId}/archive`, {});
  }

  movePaymentFromArchive(paymentId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${paymentId}/move-from-archive`, {});
  }

  movePaymentFromOthers(paymentId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${paymentId}/move-from-others`, {});
  }

  undoPatientRequest(patientRequestId: number, data: PatientRequest): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/undo`, data);
  }

  // ==========================================
  // 4. EMISSÃO DE DOCUMENTOS E PDFS
  // ==========================================

  /**
   * Faz o download do arquivo PDF mesclado.
   * É obrigatório declarar { responseType: 'blob' } para tratar o binário retornado.
   */
  downloadMergedPdf(paymentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${paymentId}/download-merged-pdf`, {
      responseType: 'blob',
    });
  }

  /**
   * Faz o download do documento memorando em PDF.
   * É obrigatório declarar { responseType: 'blob' } para tratar o binário retornado.
   */
  downloadMemoPdf(paymentId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${paymentId}/download-memo-pdf`, {
      responseType: 'blob',
    });
  }
}