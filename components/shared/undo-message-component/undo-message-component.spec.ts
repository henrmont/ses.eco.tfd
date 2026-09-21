import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UndoMessageComponent } from './undo-message-component';

describe('UndoMessageComponent', () => {
  let component: UndoMessageComponent;
  let fixture: ComponentFixture<UndoMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UndoMessageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UndoMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
