// src/app/tfd/services/setting.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingService } from './setting.service';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response.model';
import { BudgetAllocation } from '../models/budget-allocation.model';
import { DailyCost } from '../models/daily-cost.model';

describe('Tfd SettingService', () => {
  let service: SettingService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiTfdUrl}/settings`;

  const mockDailyCost = {
    id: 1,
    amount: 150,
  } as unknown as DailyCost;

  const mockBudgetAllocation = {
    id: 2,
    amount: 50000,
  } as unknown as BudgetAllocation;

  const mockApiResponse = { message: 'OK' } as unknown as ApiResponse;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), SettingService],
    });

    service = TestBed.inject(SettingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('deve consultar getDailyCosts e getBudgetAllocation via GET', () => {
    let dailyCostsResult: DailyCost[] | undefined;
    let budgetAllocationResult: BudgetAllocation | undefined;

    service.getDailyCosts().subscribe((res) => (dailyCostsResult = res));
    service.getBudgetAllocation().subscribe((res) => (budgetAllocationResult = res));

    const dailyCostsReq = httpMock.expectOne(`${baseUrl}/daily-costs`);
    expect(dailyCostsReq.request.method).toBe('GET');
    dailyCostsReq.flush([mockDailyCost]);

    const budgetReq = httpMock.expectOne(`${baseUrl}/budget-allocation`);
    expect(budgetReq.request.method).toBe('GET');
    budgetReq.flush(mockBudgetAllocation);

    expect(dailyCostsResult).toEqual([mockDailyCost]);
    expect(budgetAllocationResult).toEqual(mockBudgetAllocation);
  });

  it('deve executar updateDailyCost e updateBudgetAllocation via PATCH', () => {
    let dailyCostRes: ApiResponse | undefined;
    let budgetAllocationRes: ApiResponse | undefined;

    const dailyCostPatch: Partial<DailyCost> = { id: 1 };
    const budgetPatch: Partial<BudgetAllocation> = { id: 2 };

    service.updateDailyCost(1, dailyCostPatch).subscribe((res) => (dailyCostRes = res));
    service.updateBudgetAllocation(2, budgetPatch).subscribe((res) => (budgetAllocationRes = res));

    const dailyReq = httpMock.expectOne(`${baseUrl}/daily-costs/1`);
    expect(dailyReq.request.method).toBe('PATCH');
    expect(dailyReq.request.body).toEqual(dailyCostPatch);
    dailyReq.flush(mockApiResponse);

    const budgetReq = httpMock.expectOne(`${baseUrl}/budget-allocation/2`);
    expect(budgetReq.request.method).toBe('PATCH');
    expect(budgetReq.request.body).toEqual(budgetPatch);
    budgetReq.flush(mockApiResponse);

    expect(dailyCostRes).toEqual(mockApiResponse);
    expect(budgetAllocationRes).toEqual(mockApiResponse);
  });
});