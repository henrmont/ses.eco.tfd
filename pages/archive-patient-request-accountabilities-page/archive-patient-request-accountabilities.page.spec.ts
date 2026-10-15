import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivePatientRequestAccountabilitiesPage } from './archive-patient-request-accountabilities-page';

describe('ArchivePatientRequestAccountabilitiesPage', () => {
  let component: ArchivePatientRequestAccountabilitiesPage;
  let fixture: ComponentFixture<ArchivePatientRequestAccountabilitiesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivePatientRequestAccountabilitiesPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientRequestAccountabilitiesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
