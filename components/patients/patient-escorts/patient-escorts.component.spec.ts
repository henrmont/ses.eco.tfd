import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { provideNativeDateAdapter } from '@angular/material/core';
import { of } from 'rxjs';
import { provideNgxMask } from 'ngx-mask';
import { PatientEscortsComponent } from './patient-escorts-component';
import { PatientService } from '../../../services/patient-service';
import { CreatePatientEscortComponent } from '../create-patient-escort-component/create-patient-escort-component';
import { DeletePatientEscortComponent } from '../delete-patient-escort-component/delete-patient-escort-component';
import { ShowPatientEscortComponent } from '../show-patient-escort-component/show-patient-escort-component';
import { UpdatePatientEscortComponent } from '../update-patient-escort-component/update-patient-escort-component';
import { Escort } from '../../../models/escort';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('PatientEscortsComponent', () => {
  let component: PatientEscortsComponent;
  let fixture: ComponentFixture<PatientEscortsComponent>;
  let patientServiceMock: any;
  let dialogMock: any;

  const mockDialogData = {
    patient_care: { id: 123 },
    permissions: [
      {
        permissions: [
          { name: 'show_patient_escort' },
          { name: 'create_patient_escort' }
        ]
      }
    ]
  };

  const mockEscorts: Escort[] = [
    { id: 1, name: 'Acompanhante Um', document: '11122233344', cns: '123456789012345', status: true, birth_date: '1990-01-01', gender: 'M', is_same_address: true } as any,
    { id: 2, name: 'Acompanhante Dois', document: '55566677788', cns: '987654321098765', status: false, birth_date: '1992-05-10', gender: 'F', is_same_address: false } as any
  ];

  beforeEach(async () => {
    patientServiceMock = {
      getPatientEscorts: vi.fn().mockReturnValue(of(mockEscorts)),
      cnsEscortExistsValidator: vi.fn().mockReturnValue(() => of(null)),
      documentEscortExistsValidator: vi.fn().mockReturnValue(() => of(null))
    };

    dialogMock = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true)
      })
    };

    await TestBed.configureTestingModule({
      imports: [PatientEscortsComponent],
      providers: [
        provideNgxMask(),
        provideNativeDateAdapter(),
        { provide: PatientService, useValue: patientServiceMock },
        { provide: MatDialog, useValue: dialogMock },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    })
    .overrideComponent(PatientEscortsComponent, {
      set: {
        providers: [
          { provide: MatDialog, useValue: dialogMock }
        ]
      }
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientEscortsComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente com sucesso', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Ciclo de Inicialização (ngOnInit)', () => {
    it('deve buscar a lista de acompanhantes e atualizar os estados reativos', () => {
      expect(component['isLoading']()).toBe(true);

      fixture.detectChanges();

      expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(123);
      expect(component['isLoading']()).toBe(false);
      expect(component['dataSource']() instanceof MatTableDataSource).toBe(true);
      expect(component['dataSource']().data).toEqual(mockEscorts);
    });
  });

  describe('Ações de Modais', () => {
    beforeEach(() => {
      fixture.detectChanges();
      vi.clearAllMocks();
    });

    it('deve abrir a modal de visualização de detalhes (ShowPatientEscortComponent)', () => {
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(true)
      });

      const targetEscort = mockEscorts[0];
      component['showPatientEscort'](targetEscort);

      expect(dialogMock.open).toHaveBeenCalledWith(ShowPatientEscortComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { escort: targetEscort }
      });
    });

    it('deve abrir a modal de criação e atualizar a lista silenciosamente após o fechamento com sucesso', () => {
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(true)
      });

      component['createPatientEscort']();

      expect(dialogMock.open).toHaveBeenCalledWith(CreatePatientEscortComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_care: mockDialogData.patient_care }
      });
      expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(123);
    });

    it('deve abrir a modal de edição e recarregar dados se o retorno for positivo', () => {
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(true)
      });
      const targetEscort = mockEscorts[1];

      component['updatePatientEscort'](targetEscort);

      expect(dialogMock.open).toHaveBeenCalledWith(UpdatePatientEscortComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { patient_care: mockDialogData.patient_care, escort: targetEscort }
      });
      expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(123);
    });

    it('deve abrir a modal de exclusão e forçar o estado de loading durante a atualização da lista', () => {
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(true)
      });
      const targetEscort = mockEscorts[0];

      component['deletePatientEscort'](targetEscort);

      expect(dialogMock.open).toHaveBeenCalledWith(DeletePatientEscortComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
        data: { escort: targetEscort }
      });
      expect(patientServiceMock.getPatientEscorts).toHaveBeenCalledWith(123);
    });

    it('não deve recarregar a lista se as modais forem fechadas sem uma ação confirmada (retorno falso)', () => {
      dialogMock.open.mockReturnValue({
        afterClosed: () => of(false)
      });

      component['createPatientEscort']();

      expect(dialogMock.open).toHaveBeenCalled();
      expect(patientServiceMock.getPatientEscorts).not.toHaveBeenCalled();
    });
  });
});