import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivePatientRequestComponent } from './archive-patient-request-component';

describe('ArchivePatientRequestComponent', () => {
  let component: ArchivePatientRequestComponent;
  let fixture: ComponentFixture<ArchivePatientRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivePatientRequestComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientRequestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
