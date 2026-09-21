import { TestBed } from '@angular/core/testing';

import { CostAssistanceService } from './cost-assistance-service';

describe('CostAssistanceService', () => {
  let service: CostAssistanceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CostAssistanceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
