import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinishBackPatientComponent } from './finish-back-patient-component';

describe('FinishBackPatientComponent', () => {
  let component: FinishBackPatientComponent;
  let fixture: ComponentFixture<FinishBackPatientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinishBackPatientComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinishBackPatientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
