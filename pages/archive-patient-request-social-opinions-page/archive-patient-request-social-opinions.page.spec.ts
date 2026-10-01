import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivePatientRequestSocialOpinionsPage } from './archive-patient-request-social-opinions-page';

describe('ArchivePatientRequestSocialOpinionsPage', () => {
  let component: ArchivePatientRequestSocialOpinionsPage;
  let fixture: ComponentFixture<ArchivePatientRequestSocialOpinionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivePatientRequestSocialOpinionsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientRequestSocialOpinionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
