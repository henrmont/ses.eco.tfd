import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SigtapPage } from './sigtap-page';

describe('SigtapPage', () => {
  let component: SigtapPage;
  let fixture: ComponentFixture<SigtapPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SigtapPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SigtapPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
