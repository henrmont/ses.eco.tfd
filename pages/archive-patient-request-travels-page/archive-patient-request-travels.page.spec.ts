import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchiveTravelPatientRequestsPage } from './archive-travel-patient-requests-page';

describe('ArchiveTravelPatientRequestsPage', () => {
  let component: ArchiveTravelPatientRequestsPage;
  let fixture: ComponentFixture<ArchiveTravelPatientRequestsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveTravelPatientRequestsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchiveTravelPatientRequestsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
