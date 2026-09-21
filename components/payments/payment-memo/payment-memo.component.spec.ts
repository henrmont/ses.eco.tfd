import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentMemoComponent } from './payment-memo-component';

describe('PaymentMemoComponent', () => {
  let component: PaymentMemoComponent;
  let fixture: ComponentFixture<PaymentMemoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentMemoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PaymentMemoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
