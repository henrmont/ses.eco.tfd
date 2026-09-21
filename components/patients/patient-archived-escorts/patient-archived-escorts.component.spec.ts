import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivedPatientEscortsComponent } from './archived-patient-escorts-component';

describe('ArchivedPatientEscortsComponent', () => {
  let component: ArchivedPatientEscortsComponent;
  let fixture: ComponentFixture<ArchivedPatientEscortsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivedPatientEscortsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivedPatientEscortsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
