import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { professionalGuard } from './professional-guard';

describe('professionalGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => professionalGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
