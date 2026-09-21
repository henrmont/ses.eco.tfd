import { HttpClient } from '@angular/common/http';
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

  getPatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiUrl}`);
  }

  getArchivePatients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${this.apiUrl}/archived`);
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

  updatePatientEscort(escortId: number, data: PatientEscort): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/escorts/${escortId}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  deletePatientEscort(patientCareEscortId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/escorts/${patientCareEscortId}`);
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

  updatePatientReport(reportId: number, data: PatientReport): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/reports/${reportId}`, data);
  }

  deletePatientReport(reportId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/reports/${reportId}`);
  }

  // ==========================================
  // 4. FLUXO DE ANEXOS DE LAUDO (REPORT ATTACHMENTS)
  // ==========================================

  getReportAttachments(reportId: number): Observable<ReportAttachment[]> {
    return this.http.get<ReportAttachment[]>(`${this.apiUrl}/reports/${reportId}/attachments`);
  }

  createReportAttachment(reportId: number, data: ReportAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/reports/${reportId}/attachments`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  updateReportAttachment(reportAttachmentId: number, data: ReportAttachment): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/attachments/${reportAttachmentId}`, this.mountFormData(data as unknown as Record<string, unknown>));
  }

  deleteReportAttachment(reportAttachmentId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/attachments/${reportAttachmentId}`);
  }

  // ==========================================
  // 5. CONSULTAS DIRETAS
  // ==========================================

  getPatientCns(cns: string | number): Observable<Patient & { exists_in_tfd?: boolean }> {
    return this.http.get<Patient & { exists_in_tfd?: boolean }>(`${this.apiUrl}/cns/${cns}`);
  }

  getPatientDocument(document: string | number): Observable<Patient & { exists_in_tfd?: boolean }> {
    return this.http.get<Patient & { exists_in_tfd?: boolean }>(`${this.apiUrl}/document/${document}`);
  }

  getEscortCns(cns: string | number): Observable<PatientEscort> {
    return this.http.get<PatientEscort>(`${this.apiUrl}/escorts/cns/${cns}`);
  }

  getEscortDocument(document: string | number): Observable<PatientEscort> {
    return this.http.get<PatientEscort>(`${this.apiUrl}/escorts/document/${document}`);
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
        switchMap(() => this.getPatientCns(cnsClean)),
        map((patient) => {
          if (patient) {
            if (onFound) onFound(patient);
            return patient.exists_in_tfd ? { cnsExists: true } : null;
          }
          return null;
        }),
        catchError(() => of(null))
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
        switchMap(() => this.getPatientDocument(docClean)),
        map((patient) => {
          if (patient) {
            if (onFound) onFound(patient);
            return patient.exists_in_tfd ? { documentExists: true } : null;
          }
          return null;
        }),
        catchError(() => of(null))
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
        switchMap(() => this.getEscortCns(cns)),
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
        switchMap(() => this.getEscortDocument(document)),
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