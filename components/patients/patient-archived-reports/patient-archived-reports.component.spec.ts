import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivedPatientReportsComponent } from './archived-patient-reports-component';

describe('ArchivedPatientReportsComponent', () => {
  let component: ArchivedPatientReportsComponent;
  let fixture: ComponentFixture<ArchivedPatientReportsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivedPatientReportsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivedPatientReportsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
