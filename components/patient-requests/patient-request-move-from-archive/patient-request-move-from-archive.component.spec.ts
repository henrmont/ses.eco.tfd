import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientRequestMoveFromArchiveComponent } from './patient-request-move-from-archive-component';

describe('PatientRequestMoveFromArchiveComponent', () => {
  let component: PatientRequestMoveFromArchiveComponent;
  let fixture: ComponentFixture<PatientRequestMoveFromArchiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PatientRequestMoveFromArchiveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientRequestMoveFromArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
