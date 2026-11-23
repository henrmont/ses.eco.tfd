import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { BudgetAllocation } from '../models/budget-allocation.model';
import { DailyCost } from '../models/daily-cost.model';

@Injectable({
  providedIn: 'root',
})
export class SettingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiTfdUrl}/settings`;

  // ==========================================
  // Consultas (GET)
  // ==========================================
  getDailyCosts(): Observable<DailyCost[]> {
    return this.http.get<DailyCost[]>(`${this.apiUrl}/daily-costs`);
  }

  getBudgetAllocation(): Observable<BudgetAllocation> {
    return this.http.get<BudgetAllocation>(`${this.apiUrl}/budget-allocation`);
  }

  // ==========================================
  // Operações de Escrita / Atualização (PATCH)
  // ==========================================
  updateDailyCost(dailyCostId: number, data: Partial<DailyCost>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/daily-costs/${dailyCostId}`, data);
  }

  updateBudgetAllocation(budgetAllocationId: number, data: Partial<BudgetAllocation>): Observable<ApiResponse> {
    return this.http.patch<ApiResponse>(`${this.apiUrl}/budget-allocation/${budgetAllocationId}`, data);
  }
}