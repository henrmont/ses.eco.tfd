import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImportTravelsComponent } from './import-travels-component';

describe('ImportTravelsComponent', () => {
  let component: ImportTravelsComponent;
  let fixture: ComponentFixture<ImportTravelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportTravelsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ImportTravelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
