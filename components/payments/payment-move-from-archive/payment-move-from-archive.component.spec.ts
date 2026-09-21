import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovePatientRequestFromArchiveComponent } from './move-patient-request-from-archive-component';

describe('MovePatientRequestFromArchiveComponent', () => {
  let component: MovePatientRequestFromArchiveComponent;
  let fixture: ComponentFixture<MovePatientRequestFromArchiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovePatientRequestFromArchiveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovePatientRequestFromArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
