import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRequestArchiveComponent } from './patient-request-archive-component';

describe('PatientRequestArchiveComponent', () => {
  let component: PatientRequestArchiveComponent;
  let fixture: ComponentFixture<PatientRequestArchiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRequestArchiveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
