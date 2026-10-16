import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { tfdGuardGuard } from './tfd-guard-guard';

describe('tfdGuardGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => tfdGuardGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
