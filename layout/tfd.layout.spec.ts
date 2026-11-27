// src/app/tfd/layouts/tfd.layout.spec.ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TfdLayout } from './tfd.layout';
import { PatientCreateComponent } from '../components/patients/patient-create/patient-create.component';
import { PatientRequestCreateComponent } from '../components/patient-requests/patient-request-create/patient-request-create.component';
import { PatientRequestTravelsImportComponent } from '../components/patient-request-travels/patient-request-travels-import/patient-request-travels-import.component';
import { RoleCreateComponent } from '../components/roles/role-create/role-create.component';
import { UserCreateComponent } from '../components/users/user-create/user-create.component';
import { Professionals } from '../enums/professionals';
import { TfdUser } from '../models/user.model';
import { AuthService } from '../services/auth.service';

class MockBroadcastChannel {
  name: string;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
  }
}

describe('TfdLayout', () => {
  let component: TfdLayout;
  let fixture: ComponentFixture<TfdLayout>;

  let createdChannels: MockBroadcastChannel[];
  let currentUserSignal: ReturnType<typeof signal<TfdUser | null>>;
  let authServiceMock: {
    currentUser: ReturnType<typeof signal<TfdUser | null>>;
  };
  let dialogOpenSpy: ReturnType<typeof vi.spyOn>;
  let afterClosedSubject$: Subject<unknown>;

  const buildAdminUser = (): TfdUser =>
    ({
      professional: {
        types: [Professionals.ADMINISTRADOR],
      },
      roles: [
        {
          permissions: [
            { name: 'tfd/usuário listar' },
            { name: 'usuário criar' },
            { name: 'tfd/regra listar' },
            { name: 'regra criar' },
            { name: 'configuração listar' },
          ],
        },
      ],
    }) as unknown as TfdUser;

  async function createComponent(routeConfigPath?: string): Promise<void> {
    afterClosedSubject$ = new Subject<unknown>();

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [TfdLayout],
        providers: [
          provideRouter([]),
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: AuthService, useValue: authServiceMock },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: { routeConfig: routeConfigPath ? { path: routeConfigPath } : undefined },
              parent: { snapshot: { routeConfig: undefined } },
            },
          },
        ],
      })
      .overrideComponent(TfdLayout, {
        set: { template: '' },
      })
      .compileComponents();

    dialogOpenSpy = vi.spyOn(MatDialog.prototype, 'open').mockReturnValue({
      afterClosed: () => afterClosedSubject$.asObservable(),
    } as unknown as MatDialogRef<unknown, unknown>);

    fixture = TestBed.createComponent(TfdLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    createdChannels = [];
    currentUserSignal = signal<TfdUser | null>(buildAdminUser());
    authServiceMock = {
      currentUser: currentUserSignal,
    };

    vi.stubGlobal(
      'BroadcastChannel',
      vi.fn(function (name: string) {
        const channel = new MockBroadcastChannel(name);
        createdChannels.push(channel);
        return channel;
      })
    );

    await createComponent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('deve criar o layout, inicializar os 5 BroadcastChannels, enviar mensagens e fechar ao destruir', () => {
    expect(component).toBeTruthy();
    expect(createdChannels.map((c) => c.name)).toEqual([
      'tfd-roles-channel',
      'tfd-users-channel',
      'tfd-patients-channel',
      'tfd-patient-requests-channel',
      'tfd-travels-channel',
    ]);

    component.postMessage('USERS');
    expect(createdChannels[1].postMessage).toHaveBeenCalledWith('update');

    component.postMessage('ROLES', 'custom-event');
    expect(createdChannels[0].postMessage).toHaveBeenCalledWith('custom-event');

    expect(() =>
      component.postMessage('INVALID_KEY' as unknown as 'USERS', 'noop')
    ).not.toThrow();

    fixture.destroy();
    createdChannels.forEach((channel) => {
      expect(channel.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reatividade de permissões, tipos profissionais e menu visível', () => {
    it('deve filtrar grupos e itens do menu para administrador com permissões', () => {
      const visible = component['visibleMenuGroups']();
      expect(visible.map((g) => g.subHeader)).toEqual(['Usuários', 'Regras', 'Configurações']);
      expect(visible[0].items.map((i) => i.label)).toEqual(['Usuários', 'Novo usuário']);
    });

    it('deve suportar diferentes formatos de tipos profissionais e prefixo de rota', async () => {
      currentUserSignal.set({
        professional: {
          types: [
            { type: Professionals.CADASTRO },
            { name: Professionals.MEDICO },
            { description: Professionals.PASSAGEM },
            123,
            null,
          ],
        },
        roles: [
          {
            permissions: [
              { name: 'modulo-custom/paciente listar' },
              { name: 'paciente criar' },
              { name: 'parecer listar' },
              { name: 'passagem listar' },
              { name: 'passagem criar' },
              { name: '' },
            ],
          },
          {},
        ],
      } as unknown as TfdUser);

      await createComponent('modulo-custom');
      fixture.detectChanges();

      const headers = component['visibleMenuGroups']().map((g) => g.subHeader);
      expect(headers).toEqual(['Pacientes', 'Pareceres Médicos', 'Passagens']);
    });

    it('deve suportar professional.type único e ocultar itens sem permissão ou sem usuário', () => {
      currentUserSignal.set({
        professional: { type: `  ${Professionals.AJUDA_DE_CUSTO}  ` },
        roles: [{ permissions: [{ name: 'ajuda de custo listar' }] }],
      } as unknown as TfdUser);

      const headers = component['visibleMenuGroups']().map((g) => g.subHeader);
      expect(headers).toEqual(['Ajuda de custo', 'Prestações de conta']);

      currentUserSignal.set({
        professional: { types: [Professionals.PAGAMENTO] },
        roles: [],
      } as unknown as TfdUser);
      expect(component['visibleMenuGroups']()).toEqual([]);

      currentUserSignal.set(null);
      expect(component['userProfessionalTypes']()).toEqual([]);
      expect(component['visibleMenuGroups']()).toEqual([]);
    });
  });

  describe('Ações de Diálogo', () => {
    it('deve abrir UserCreateComponent e publicar no canal USERS quando fechado com sucesso', () => {
      const usersChannel = createdChannels[1];
      component['userCreate']();

      expect(dialogOpenSpy).toHaveBeenCalledWith(UserCreateComponent, {
        width: '700px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
      });

      afterClosedSubject$.next(true);
      afterClosedSubject$.complete();
      expect(usersChannel.postMessage).toHaveBeenCalledWith('update');
    });

    it('deve abrir RoleCreateComponent, PatientCreateComponent, PatientRequestCreateComponent e PatientRequestTravelsImportComponent', () => {
      const rolesChannel = createdChannels[0];
      const patientsChannel = createdChannels[2];
      const requestsChannel = createdChannels[3];
      const travelsChannel = createdChannels[4];

      component['roleCreate']();
      expect(dialogOpenSpy).toHaveBeenCalledWith(RoleCreateComponent, {
        width: '900px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
      });

      component['patientCreate']();
      expect(dialogOpenSpy).toHaveBeenCalledWith(PatientCreateComponent, {
        width: '1200px',
        height: '700px',
        disableClose: true,
        autoFocus: false,
      });

      component['patientRequestCreate']();
      expect(dialogOpenSpy).toHaveBeenCalledWith(PatientRequestCreateComponent, {
        width: '800px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
      });

      component['patientRequestTravelsImport']();
      expect(dialogOpenSpy).toHaveBeenCalledWith(PatientRequestTravelsImportComponent, {
        width: '400px',
        height: 'auto',
        disableClose: true,
        autoFocus: false,
      });

      afterClosedSubject$.next(false);
      afterClosedSubject$.complete();

      expect(rolesChannel.postMessage).not.toHaveBeenCalled();
      expect(patientsChannel.postMessage).not.toHaveBeenCalled();
      expect(requestsChannel.postMessage).not.toHaveBeenCalled();
      expect(travelsChannel.postMessage).not.toHaveBeenCalled();
    });
  });
});