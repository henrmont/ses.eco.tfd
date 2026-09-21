import { TestBed } from '@angular/core/testing';

import { DatasusService } from './datasus-service';

describe('DatasusService', () => {
  let service: DatasusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DatasusService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
