import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchiveAccountabilityPatientRequestsPage } from './archive-accountability-patient-requests-page';

describe('ArchiveAccountabilityPatientRequestsPage', () => {
  let component: ArchiveAccountabilityPatientRequestsPage;
  let fixture: ComponentFixture<ArchiveAccountabilityPatientRequestsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveAccountabilityPatientRequestsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchiveAccountabilityPatientRequestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
