import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRequirementComponent } from './patient-requirement-component';

describe('PatientRequirementComponent', () => {
  let component: PatientRequirementComponent;
  let fixture: ComponentFixture<PatientRequirementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRequirementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
