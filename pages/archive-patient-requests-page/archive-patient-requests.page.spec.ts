import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivePatientRequestsPage } from './archive-patient-requests-page';

describe('ArchivePatientRequestsPage', () => {
  let component: ArchivePatientRequestsPage;
  let fixture: ComponentFixture<ArchivePatientRequestsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivePatientRequestsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientRequestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
