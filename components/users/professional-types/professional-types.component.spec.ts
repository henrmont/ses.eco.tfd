import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfessionalTypesComponent } from './professional-types-component';

describe('ProfessionalTypesComponent', () => {
  let component: ProfessionalTypesComponent;
  let fixture: ComponentFixture<ProfessionalTypesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfessionalTypesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProfessionalTypesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
