import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { catchError, map, Observable, of, switchMap, timer } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientCare } from '../models/patient-care.model';
import { PatientEscort } from '../models/patient-escort.model';
import { PatientReport } from '../models/patient-report.model';
import { Patient } from '../models/patient.model';
import { ReportAttachment } from '../models/report-attachment.model';

interface CidOption {
  id: number;
  code: string;
  description: string;
}

type PatientLookupResult = Patient & { exists_in_tfd?: boolean };

interface MomentLike {
  format(pattern: string): string;
}

@Injectable({
  providedIn: 'root',
})
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/patients`;

  // ==========================================
  // Consultas (GET)
  // ==========================================
  getPatients(): Observable<PatientCare[]> {
    return this.http.get<PatientCare[]>(this.apiUrl);
  }

  getArchivePatients(): Observable<PatientCare[]> {
    return this.http.get<PatientCare[]>(`${this.apiUrl}/archived`);
  }

  getPatientEscorts(patientCareId: number): Observable<PatientEscort[]> {
    return this.http.get<PatientEscort[]>(`${this.apiUrl}/${patientCareId}/escorts`);
  }

  getPatientReports(patientCareId: number): Observable<PatientReport[]> {
    return this.http.get<PatientReport[]>(`${this.apiUrl}/${patientCareId}/reports`);
  }

  getCids(patientCareId: number): Observable<CidOption[]> {
    return this.http.get<CidOption[]>(`${this.apiUrl}/${patientCareId}/cids`);
  }

  getReportAttachments(patientCareId: number, reportId: number): Observable<ReportAttachment[]> {
    return this.http.get<ReportAttachment[]>(`${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments`);
  }

  // ==========================================
  // Operações de Escrita / CRUD
  // ==========================================
  createPatient(data: Patient): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.apiUrl, this.mountFormData(data));
  }

  updatePatient(patientCareId: number, data: Patient): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}`, this.mountFormData(data, 'PUT'));
  }

  createPatientEscort(patientCareId: number, data: PatientEscort): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/${patientCareId}/escorts`,
      this.mountFormData(data)
    );
  }

  updatePatientEscort(patientCareId: number, escortId: number, data: PatientEscort): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/${patientCareId}/escorts/${escortId}`,
      this.mountFormData(data, 'PUT')
    );
  }

  deletePatientEscort(patientCareId: number, escortId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientCareId}/escorts/${escortId}`);
  }

  createPatientReport(patientCareId: number, data: PatientReport): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports`, data);
  }

  updatePatientReport(patientCareId: number, reportId: number, data: PatientReport): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}`, data);
  }

  deletePatientReport(patientCareId: number, reportId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}`);
  }

  createReportAttachment(patientCareId: number, reportId: number, data: ReportAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments`,
      this.mountFormData(data)
    );
  }

  updateReportAttachment(
    patientCareId: number,
    reportId: number,
    attachmentId: number,
    data: ReportAttachment
  ): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(
      `${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments/${attachmentId}`,
      this.mountFormData(data, 'PUT')
    );
  }

  deleteReportAttachment(patientCareId: number, reportId: number, attachmentId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(
      `${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments/${attachmentId}`
    );
  }

  // ==========================================
  // Ações de Estado do Atendimento
  // ==========================================
  archivePatient(patientCareId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientCareId}/archive`, {});
  }

  movePatientFromArchive(patientCareId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientCareId}/move-from-archive`, {});
  }

  movePatientFromOthers(patientCareId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientCareId}/move-from-others`, {});
  }

  validatePatient(patientCareId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientCareId}/validate`, {});
  }

  finishBackPatient(patientCareId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientCareId}/finish-back`, {});
  }

  // ==========================================
  // Métodos de Checagem HTTP (Query Params REST)
  // ==========================================
  getPatientCns(cns: string | number): Observable<PatientLookupResult | null> {
    return this.searchPatientByParam('cns', this.cleanDigits(cns));
  }

  getPatientDocument(document: string | number): Observable<PatientLookupResult | null> {
    return this.searchPatientByParam('document', this.cleanDigits(document));
  }

  getEscortCns(cns: string | number): Observable<PatientEscort | null> {
    return this.searchEscortByParam('cns', this.cleanDigits(cns));
  }

  getEscortDocument(document: string | number): Observable<PatientEscort | null> {
    return this.searchEscortByParam('document', this.cleanDigits(document));
  }

  // ==========================================
  // Validadores Assíncronos Nativos (com Debounce)
  // ==========================================
  cnsPatientExistsValidator(
    currentCns?: string | null,
    onFound?: (patient: Patient) => void
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const cnsClean = this.cleanDigits(control.value);
      const currentClean = this.cleanDigits(currentCns);

      if (cnsClean.length !== 15 || (currentClean && cnsClean === currentClean) || !control.dirty) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getPatientCns(cnsClean).pipe(
            map((patient) => {
              if (!patient) return null;
              onFound?.(patient);
              return patient.exists_in_tfd ? { cnsExists: true } : null;
            }),
            catchError(() => of(null))
          )
        )
      );
    };
  }

  documentPatientExistsValidator(
    currentDocument?: string | null,
    onFound?: (patient: Patient) => void
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const docClean = this.cleanDigits(control.value);
      const currentClean = this.cleanDigits(currentDocument);

      if (!this.isValidDocumentLength(docClean) || (currentClean && docClean === currentClean) || !control.dirty) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getPatientDocument(docClean).pipe(
            map((patient) => {
              if (!patient) return null;
              onFound?.(patient);
              return patient.exists_in_tfd ? { documentExists: true } : null;
            }),
            catchError(() => of(null))
          )
        )
      );
    };
  }

  cnsEscortExistsValidator(
    patientCare: PatientCare | null | undefined,
    currentCns?: string | null,
    onFound?: (escort: PatientEscort) => void
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const cns = this.cleanDigits(control.value);
      const current = this.cleanDigits(currentCns);

      if (cns.length !== 15 || (current && cns === current) || !control.dirty) {
        return of(null);
      }

      const patientCns = this.cleanDigits(patientCare?.patient?.cns);
      if (patientCns && patientCns === cns) {
        return of({ cnsPatientExists: true });
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getEscortCns(cns).pipe(
            map((escort) => {
              if (!escort) return null;
              onFound?.(escort);

              if (patientCare?.id) {
                const existsInCurrentCare = this.isEscortInCare(patientCare, 'cns', cns);
                return existsInCurrentCare ? { cnsExists: true } : null;
              }

              return { cnsExists: true };
            }),
            catchError(() => of(null))
          )
        )
      );
    };
  }

  documentEscortExistsValidator(
    patientCare: PatientCare | null | undefined,
    currentDocument?: string | null,
    onFound?: (escort: PatientEscort) => void
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const document = this.cleanDigits(control.value);
      const current = this.cleanDigits(currentDocument);

      if (!this.isValidDocumentLength(document) || (current && document === current) || !control.dirty) {
        return of(null);
      }

      const patientDocument = this.cleanDigits(patientCare?.patient?.document);
      if (patientDocument && patientDocument === document) {
        return of({ documentPatientExists: true });
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getEscortDocument(document).pipe(
            map((escort) => {
              if (!escort) return null;
              onFound?.(escort);

              if (patientCare?.id) {
                const existsInCurrentCare = this.isEscortInCare(patientCare, 'document', document);
                return existsInCurrentCare ? { documentExists: true } : null;
              }

              return { documentExists: true };
            }),
            catchError(() => of(null))
          )
        )
      );
    };
  }

  // ==========================================
  // Métodos Auxiliares Privados
  // ==========================================
  private searchPatientByParam(paramKey: 'cns' | 'document', value: string): Observable<PatientLookupResult | null> {
    const params = new HttpParams().set(paramKey, value);
    return this.http
      .get<PatientLookupResult>(`${this.apiUrl}/search`, { params })
      .pipe(catchError(() => of(null)));
  }

  private searchEscortByParam(paramKey: 'cns' | 'document', value: string): Observable<PatientEscort | null> {
    const params = new HttpParams().set(paramKey, value);
    return this.http
      .get<PatientEscort>(`${this.apiUrl}/escorts/search`, { params })
      .pipe(catchError(() => of(null)));
  }

  private cleanDigits(value: unknown): string {
    return value ? String(value).replace(/\D/g, '') : '';
  }

  private isValidDocumentLength(digits: string): boolean {
    return digits.length === 11 || digits.length === 14;
  }

  private isEscortInCare(patientCare: PatientCare, field: 'cns' | 'document', cleanValue: string): boolean {
    return Boolean(patientCare.escorts?.some((escort) => this.cleanDigits(escort[field]) === cleanValue));
  }

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
    return typeof value === 'object' && value !== null && typeof (value as MomentLike).format === 'function';
  }
}