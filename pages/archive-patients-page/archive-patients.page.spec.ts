import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArchivePatientsPage } from './archive-patients-page';

describe('ArchivePatientsPage', () => {
  let component: ArchivePatientsPage;
  let fixture: ComponentFixture<ArchivePatientsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchivePatientsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArchivePatientsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
