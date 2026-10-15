import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRequestRequirement } from './patient-request-requirement';

describe('PatientRequestRequirement', () => {
  let component: PatientRequestRequirement;
  let fixture: ComponentFixture<PatientRequestRequirement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRequestRequirement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestRequirement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
