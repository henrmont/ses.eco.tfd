import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivePaymentPatientRequestsPage } from './archive-payment-patient-requests-page';

describe('ArchivePaymentPatientRequestsPage', () => {
  let component: ArchivePaymentPatientRequestsPage;
  let fixture: ComponentFixture<ArchivePaymentPatientRequestsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivePaymentPatientRequestsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivePaymentPatientRequestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
