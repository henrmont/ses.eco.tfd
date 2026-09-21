import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-undo-message-component',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './undo-message-component.html',
  styleUrl: './undo-message-component.scss',
})
export class UndoMessageComponent {
  
  data = inject(MAT_DIALOG_DATA);

}
