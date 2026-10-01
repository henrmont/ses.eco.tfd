import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRequestSocialOpinionsPage } from './patient-request-social-opinions-page';

describe('PatientRequestSocialOpinionsPage', () => {
  let component: PatientRequestSocialOpinionsPage;
  let fixture: ComponentFixture<PatientRequestSocialOpinionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRequestSocialOpinionsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestSocialOpinionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
