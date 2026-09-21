import { TestBed } from '@angular/core/testing';

import { AccountabilityService } from './accountability-service';

describe('AccountabilityService', () => {
  let service: AccountabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccountabilityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
