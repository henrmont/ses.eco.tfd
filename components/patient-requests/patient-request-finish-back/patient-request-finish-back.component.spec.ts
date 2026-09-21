import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinishBackPatientRequestComponent } from './finish-back-patient-request-component';

describe('FinishBackPatientRequestComponent', () => {
  let component: FinishBackPatientRequestComponent;
  let fixture: ComponentFixture<FinishBackPatientRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinishBackPatientRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinishBackPatientRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
