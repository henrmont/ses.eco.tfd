import { TestBed } from '@angular/core/testing';

import { HospitalUnityService } from './hospital-unity-service';

describe('HospitalUnityService', () => {
  let service: HospitalUnityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HospitalUnityService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
