import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UpdateBudgetAllocationComponent } from './update-budget-allocation-component';

describe('UpdateBudgetAllocationComponent', () => {
  let component: UpdateBudgetAllocationComponent;
  let fixture: ComponentFixture<UpdateBudgetAllocationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpdateBudgetAllocationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UpdateBudgetAllocationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
