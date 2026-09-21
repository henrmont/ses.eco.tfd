import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MovePatientFromArchiveComponent } from './move-patient-from-archive-component';

describe('MovePatientFromArchiveComponent', () => {
  let component: MovePatientFromArchiveComponent;
  let fixture: ComponentFixture<MovePatientFromArchiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovePatientFromArchiveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MovePatientFromArchiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
