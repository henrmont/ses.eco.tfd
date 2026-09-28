import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientEscortRequirementComponent } from './patient-escort-requirement-component';

describe('PatientEscortRequirementComponent', () => {
  let component: PatientEscortRequirementComponent;
  let fixture: ComponentFixture<PatientEscortRequirementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientEscortRequirementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientEscortRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
