import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRequestRequirementComponent } from './patient-request-requirement-component';

describe('PatientRequestRequirementComponent', () => {
  let component: PatientRequestRequirementComponent;
  let fixture: ComponentFixture<PatientRequestRequirementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRequestRequirementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
