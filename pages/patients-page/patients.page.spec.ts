import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PatientService } from '../../services/patient-service';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// 1. Estrutura de espionagem idêntica à users-page para isolar o canal
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

// Stub do canal antes de carregar o componente (evita vazamento)
vi.stubGlobal('BroadcastChannel', class {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  set onmessage(callback: any) {
    canalCallback = callback;
  }
  get onmessage() {
    return canalCallback;
  }
  postMessage(message: any) {
    broadcastChannelMock.postMessage(message);
    if (canalCallback) {
      canalCallback({ data: message });
    }
  }
  close() {
    broadcastChannelMock.close();
  }
});

describe('PatientsPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;
  
  let mockPatientService: any;
  let mockMatDialog: any;
  let mockActivatedRoute: any;

  const mockPatientsResponse = [
    {
      id: 1,
      is_archived: false,
      owner: true,
      status: true,
      is_valid: true,
      patient: { name: 'Paciente Titular Ativo', cns: '123456789012345', document: '12345678901', document_type: 'CPF' }
    },
    {
      id: 2,
      is_archived: false,
      owner: false,
      status: true,
      is_valid: false,
      patient: { name: 'Paciente Vinculado Inativo', cns: '987654321098765' },
      user: { professional: { name: 'Dr. Lucas Silva' } }
    },
    {
      id: 3,
      is_archived: true,
      owner: true,
      patient: { name: 'Paciente Arquivado' }
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    mockPatientService = {
      getPatients: vi.fn().mockReturnValue(of(mockPatientsResponse))
    };

    mockMatDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(true))
      })
    };

    mockActivatedRoute = {
      parent: {
        parent: {
          snapshot: {
            data: {
              user: {
                id: 99,
                roles: [{ permissions: [{ name: 'tfd/paciente validar' }, { name: 'tfd/paciente atualizar' }] }]
              }
            }
          }
        }
      }
    };

    // 2. Dynamic Import crucial para blindar o hoisting do Vitest
    const { PatientsPage } = await import('./patients-page');

    await TestBed.configureTestingModule({
      imports: [PatientsPage],
      providers: [
        { provide: PatientService, useValue: mockPatientService },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideEnvironmentNgxMask()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PatientsPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  // --- BLOCO 1: INICIALIZAÇÃO E CARREGAMENTO DE DADOS ---
  describe('Inicialização', () => {
    it('deve criar o componente com sucesso', () => {
      expect(component).toBeTruthy();
    });

    it('deve carregar a lista de pacientes e separar os DataSources por "Owner" (Titular) e "Others" (Outros)', () => {
      fixture.detectChanges();

      expect(mockPatientService.getPatients).toHaveBeenCalledTimes(1);

      const ownerData = component['ownerDataSource']().data;
      expect(ownerData.length).toBe(1);
      expect(ownerData[0].name).toBe('Paciente Titular Ativo');

      const othersData = component['othersDataSource']().data;
      expect(othersData.length).toBe(1);
      expect(othersData[0].professional).toBe('Dr. Lucas Silva');
    });

    it('deve fechar o BroadcastChannel corretamente ao destruir o componente', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      
      expect(broadcastChannelMock.close).toHaveBeenCalled();
    });
  });

  // --- BLOCO 2: REATIVIDADE DO FILTRO DA DATA TABLE ---
  describe('Filtros', () => {
    it('deve aplicar filtro de busca na listagem de titulares', () => {
      fixture.detectChanges();
      const mockEvent = { target: { value: '  PACIENTE TITULAR ' } } as unknown as Event;
      
      component['applyOwnerFilter'](mockEvent);
      
      expect(component['ownerDataSource']().filter).toBe('paciente titular');
    });
  });

  // --- BLOCO 3: SEGURANÇA E PERMISSÕES ---
  describe('Controle de Permissões', () => {
    it('deve retornar TRUE quando o usuário logado possui a permissão solicitada', () => {
      fixture.detectChanges();
      const possuiAcesso = component['checkPermissions']('tfd/paciente validar');
      expect(possuiAcesso).toBe(true);
    });

    it('deve retornar FALSE quando o usuário logado NÃO possui a permissão solicitada', () => {
      fixture.detectChanges();
      const possuiAcesso = component['checkPermissions']('tfd/paciente deletar_inexistente');
      expect(possuiAcesso).toBe(false);
    });
  });

  // --- BLOCO 4: FLUXOS DE MODAIS E BROADCASTS ---
  describe('Ações de Modais e Mensageria', () => {
    beforeEach(() => {
      // Limpa os contadores acumulados da inicialização antes de testar as ações
      mockPatientService.getPatients.mockClear();
      broadcastChannelMock.postMessage.mockClear();
      canalCallback = null; // Isola eventos de broadcast anteriores
    });

    it('deve abrir a modal de atualizar paciente e emitir alteração no canal de Broadcast quando concluído', async () => {
      fixture.detectChanges(); // 1ª chamada de getPatients aqui
      const pacienteFake = mockPatientsResponse[0] as any;

      component['updatePatient'](pacienteFake);
      
      await Promise.resolve();
      fixture.detectChanges();

      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      
      // 1 (do detectChanges) + 1 (do afterClosed) + 1 (do eco do onmessage callback) = 3
      expect(mockPatientService.getPatients).toHaveBeenCalledTimes(3); 
    });

    it('deve abrir a modal de visualização de prontuário sem disparar recarregamento ou broadcast', async () => {
      // Força o modal a fechar SEM alteração (retornando false), condizente com uma ação de visualização
      mockMatDialog.open.mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of(false))
      });

      fixture.detectChanges();
      const pacienteFake = mockPatientsResponse[0] as any;

      component['showPatient'](pacienteFake);
      
      await Promise.resolve();
      fixture.detectChanges();

      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockPatientService.getPatients).toHaveBeenCalledTimes(1); // Apenas a chamada inicial do detectChanges
    });
  });
});