import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TravelPassengerRequirementComponent } from './travel-passenger-requirement-component';

describe('TravelPassengerRequirementComponent', () => {
  let component: TravelPassengerRequirementComponent;
  let fixture: ComponentFixture<TravelPassengerRequirementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TravelPassengerRequirementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TravelPassengerRequirementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
