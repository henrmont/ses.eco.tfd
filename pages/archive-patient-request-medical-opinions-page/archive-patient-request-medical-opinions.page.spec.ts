import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchiveOpinionPatientRequestsPage } from './archive-opinion-patient-requests-page';

describe('ArchiveOpinionPatientRequestsPage', () => {
  let component: ArchiveOpinionPatientRequestsPage;
  let fixture: ComponentFixture<ArchiveOpinionPatientRequestsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveOpinionPatientRequestsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchiveOpinionPatientRequestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
