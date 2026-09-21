import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { Observable, catchError, map, of } from 'rxjs';
import * as moment from 'moment';

// Environments & Models
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { PatientRequest } from '../models/patient-request.model';

// Interfaces de apoio específicas do serviço
export interface UnifiedPassengerOption {
  id: number;
  name: string;
  isPatient: boolean;
  typeLabel: string;
}

@Injectable({
  providedIn: 'root',
})
export class PatientRequestTravelService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/travels`;

  // ==========================================
  // 1. CONSULTAS E LISTAGENS PRINCIPAIS
  // ==========================================

  getPatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests`);
  }

  getArchivePatientRequests(): Observable<PatientRequest[]> {
    return this.http.get<PatientRequest[]>(`${this.apiUrl}/patient-requests/archived`);
  }

  getPatientEscorts(patientCareId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/patient-cares/${patientCareId}/escorts`);
  }

  // ==========================================
  // 2. OPERAÇÕES DE VIAGENS (PATIENT-REQUEST-TRAVELS)
  // ==========================================

  getTravels(patientRequestId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/patient-requests/${patientRequestId}`);
  }

  createTravel(patientRequestId: number, data: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}`, data);
  }

  updateTravel(travelId: number, data: any): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/${travelId}`, data);
  }

  deleteTravel(travelId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${travelId}`);
  }

  importTravels(data: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/import`, data);
  }

  // ==========================================
  // 3. OPERAÇÕES DE PASSAGEIROS (TRAVELS-PASSENGERS)
  // ==========================================

  getPassengers(travelId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${travelId}/passengers`);
  }

  createPassenger(travelId: number, data: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${travelId}/passengers`, data);
  }

  updatePassenger(passengerId: number, data: any): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/passengers/${passengerId}`, data);
  }

  deletePassenger(passengerId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/passengers/${passengerId}`);
  }

  // ==========================================
  // 4. OPERAÇÕES DE ROTAS (TRAVELS-ROUTES)
  // ==========================================

  getRoutes(travelId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${travelId}/routes`);
  }

  createRoute(travelId: number, data: any): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.apiUrl}/${travelId}/routes`, this.mountFormData(data));
  }

  updateRoute(routeId: number, data: any): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/routes/${routeId}`, this.mountFormData(data));
  }

  deleteRoute(routeId: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/routes/${routeId}`);
  }

  // ==========================================
  // 5. TRAMITAÇÕES, PROCESSAMENTOS E ACOMPANHANTES
  // ==========================================

  patientRequestEscorts(patientRequestId: number, data: any): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/escorts`, data);
  }

  undoPatientRequest(patientRequestId: number, data: PatientRequest): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/undo`, data);
  }

  finishBackPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/finish-back`, {});
  }

  // ==========================================
  // 6. AÇÕES DE ESTADO, MOVIMENTAÇÕES E ARQUIVAMENTO
  // ==========================================

  archivePatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/archive`, {});
  }

  haltedPatientRequest(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/halted`, {});
  }

  movePatientRequestFromArchive(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-archive`, {});
  }

  movePatientRequestFromOthers(patientRequestId: number): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/patient-requests/${patientRequestId}/move-from-others`, {});
  }

  // ==========================================
  // 7. VALIDADORES ASSÍNCRONOS & AUXILIARES
  // ==========================================
  passengerExistsValidator(travelId: number | null | undefined): AsyncValidatorFn {
    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      const selectedOption = control.value as UnifiedPassengerOption | null;

      if (!selectedOption || !travelId) {
        return of(null);
      }

      const params = new HttpParams()
        .set('passenger_id', selectedOption.id.toString())
        .set('is_patient', selectedOption.isPatient.toString());

      return this.http
        .get<{ passengerExists: boolean }>(`${this.apiUrl}/${travelId}/passengers/exists`, { params })
        .pipe(
          map(res => {
            const exists = res && (res.passengerExists === true || (res as any) === true);
            return exists ? { passengerExists: true } : null;
          }),
          catchError(() => of(null))
        );
    };
  }

  private mountFormData(data: any): FormData {
    const formData = new FormData();

    if (!data) return formData;

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof File || value instanceof Blob) {
        formData.append(key, value, 'file');
      } else if (moment.isMoment(value)) {
        formData.append(key, value.format('YYYY-MM-DD'));
      } else if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    }

    return formData;
  }
}