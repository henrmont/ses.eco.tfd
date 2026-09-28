import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, catchError, map, of, switchMap, timer } from 'rxjs';
import * as moment from 'moment';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientCare } from '../models/patient-care.model';
import { PatientEscort } from '../models/patient-escort.model';
import { PatientReport } from '../models/patient-report.model';
import { Patient } from '../models/patient.model';
import { ReportAttachment } from '../models/report-attachment.model';

export interface CidOption {
  id: number;
  code: string;
  description: string;
}

@Injectable({
  providedIn: 'root',
})
export class PatientService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/patients`;

  // ==========================================
  // 1. FLUXO DE PACIENTES
  // ==========================================

  getPatients(): Observable<PatientCare[]> {
    return this.http.get<PatientCare[]>(`${this.apiUrl}`);
  }

  getArchivePatients(): Observable<PatientCare[]> {
    return this.http.get<PatientCare[]>(`${this.apiUrl}/archived`);
  }

  createPatient(data: Patient): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  updatePatient(patientCareId: number, data: Patient): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

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
  // 2. FLUXO DE ACOMPANHANTES (ESCORTS)
  // ==========================================

  getPatientEscorts(patientCareId: number): Observable<PatientEscort[]> {
    return this.http.get<PatientEscort[]>(`${this.apiUrl}/${patientCareId}/escorts`);
  }

  createPatientEscort(patientCareId: number, data: PatientEscort): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}/escorts`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  updatePatientEscort(patientCareId: number, escortId: number, data: PatientEscort): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}/escorts/${escortId}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  deletePatientEscort(patientCareId: number, escortId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientCareId}/escorts/${escortId}`);
  }

  // ==========================================
  // 3. FLUXO DE PRONTUÁRIOS / LAUDOS (REPORTS)
  // ==========================================

  getPatientReports(patientCareId: number): Observable<PatientReport[]> {
    return this.http.get<PatientReport[]>(`${this.apiUrl}/${patientCareId}/reports`);
  }

  getCids(patientCareId: number): Observable<CidOption[]> {
    return this.http.get<CidOption[]>(`${this.apiUrl}/${patientCareId}/cids`);
  }

  createPatientReport(patientCareId: number, data: PatientReport): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports`, data);
  }

  updatePatientReport(patientCareId: number, reportId: number, data: PatientReport): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}`, data);
  }

  deletePatientReport(patientCareId: number, reportId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}`);
  }

  // ==========================================
  // 4. FLUXO DE ANEXOS DE LAUDO (REPORT ATTACHMENTS)
  // ==========================================

  getReportAttachments(patientCareId: number, reportId: number): Observable<ReportAttachment[]> {
    return this.http.get<ReportAttachment[]>(`${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments`);
  }

  createReportAttachment(patientCareId: number, reportId: number, data: ReportAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  updateReportAttachment(patientCareId: number, reportId: number, attachmentId: number, data: ReportAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments/${attachmentId}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  deleteReportAttachment(patientCareId: number, reportId: number, attachmentId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${patientCareId}/reports/${reportId}/attachments/${attachmentId}`);
  }

  // ==========================================
  // 5. CONSULTAS DIRETAS (COM TRATAMENTO DE 404/NULL)
  // ==========================================

  getPatientCns(cns: string | number): Observable<(Patient & { exists_in_tfd?: boolean }) | null> {
    return this.http.get<Patient & { exists_in_tfd?: boolean }>(`${this.apiUrl}/search/cns/${cns}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return of(null);
      })
    );
  }

  getPatientDocument(document: string | number): Observable<(Patient & { exists_in_tfd?: boolean }) | null> {
    return this.http.get<Patient & { exists_in_tfd?: boolean }>(`${this.apiUrl}/search/document/${document}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return of(null);
      })
    );
  }

  getEscortCns(cns: string | number): Observable<PatientEscort | null> {
    return this.http.get<PatientEscort>(`${this.apiUrl}/escorts/search/cns/${cns}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return of(null);
      })
    );
  }

  getEscortDocument(document: string | number): Observable<PatientEscort | null> {
    return this.http.get<PatientEscort>(`${this.apiUrl}/escorts/search/document/${document}`).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          return of(null);
        }
        return of(null);
      })
    );
  }

  // ==========================================
  // 6. VALIDATORS ASSÍNCRONOS REATIVOS
  // ==========================================

  cnsPatientExistsValidator(
    currentCns?: string | null,
    onFound?: (patient: Patient) => void
  ): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const cnsClean = control.value ? String(control.value).replace(/\D/g, '') : '';
      const currentClean = currentCns ? String(currentCns).replace(/\D/g, '') : '';

      if (cnsClean.length !== 15 || (currentClean && cnsClean === currentClean) || !control.dirty) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getPatientCns(cnsClean).pipe(
            map((patient) => {
              if (patient) {
                if (onFound) onFound(patient);
                return patient.exists_in_tfd ? { cnsExists: true } : null;
              }
              return null;
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
      const docClean = control.value ? String(control.value).replace(/\D/g, '') : '';
      const currentClean = currentDocument ? String(currentDocument).replace(/\D/g, '') : '';

      if (
        (docClean.length !== 11 && docClean.length !== 14) ||
        (currentClean && docClean === currentClean) ||
        !control.dirty
      ) {
        return of(null);
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getPatientDocument(docClean).pipe(
            map((patient) => {
              if (patient) {
                if (onFound) onFound(patient);
                return patient.exists_in_tfd ? { documentExists: true } : null;
              }
              return null;
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
      const cns = control.value ? String(control.value).replace(/\D/g, '') : '';
      const current = currentCns ? String(currentCns).replace(/\D/g, '') : '';

      if (cns.length !== 15 || (current && cns === current) || !control.dirty) {
        return of(null);
      }

      const patientCns = patientCare?.patient?.cns ? String(patientCare.patient.cns).replace(/\D/g, '') : '';
      if (patientCns && patientCns === cns) {
        return of({ cnsPatientExists: true });
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getEscortCns(cns).pipe(
            map((escort) => {
              if (escort) {
                if (onFound) onFound(escort);

                if (patientCare?.id) {
                  const existsInCurrentCare = patientCare.escorts?.some(
                    (e) => String(e.cns).replace(/\D/g, '') === cns
                  );
                  return existsInCurrentCare ? { cnsExists: true } : null;
                }

                return { cnsExists: true };
              }
              return null;
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
      const document = control.value ? String(control.value).replace(/\D/g, '') : '';
      const current = currentDocument ? String(currentDocument).replace(/\D/g, '') : '';

      if (
        (document.length !== 11 && document.length !== 14) ||
        (current && document === current) ||
        !control.dirty
      ) {
        return of(null);
      }

      const patientDocument = patientCare?.patient?.document
        ? String(patientCare.patient.document).replace(/\D/g, '')
        : '';

      if (patientDocument && patientDocument === document) {
        return of({ documentPatientExists: true });
      }

      return timer(400).pipe(
        switchMap(() =>
          this.getEscortDocument(document).pipe(
            map((escort) => {
              if (escort) {
                if (onFound) onFound(escort);

                if (patientCare?.id) {
                  const existsInCurrentCare = patientCare.escorts?.some(
                    (e) => String(e.document).replace(/\D/g, '') === document
                  );
                  return existsInCurrentCare ? { documentExists: true } : null;
                }

                return { documentExists: true };
              }
              return null;
            }),
            catchError(() => of(null))
          )
        )
      );
    };
  }

  // ==========================================
  // 7. MÉTODOS AUXILIARES PRIVADOS
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