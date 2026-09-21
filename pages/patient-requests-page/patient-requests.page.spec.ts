import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { PatientRequestService } from '../../services/patient-request-service';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// 1. Estrutura de espionagem para isolar o barramento global do BroadcastChannel
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

// Stub do canal antes de carregar o componente (evita vazamentos e interações entre specs)
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

describe('PatientRequestsPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;
  
  let mockPatientRequestService: any;
  let mockMatDialog: any;
  let mockActivatedRoute: any;

  // Mock robusto cobrindo perfeitamente as 3 regras de filtragem da página
  const mockPatientRequestsResponse = [
    {
      id: 1,
      type: 'Consulta Especializada',
      consultation_date: '2026-06-15',
      status: 'Pendente',
      owner: true,
      medical_professional: false,
      back_to_owner: false,
      medical_status: true,
      social_status: true,
      report: { patient_care: { patient: { name: 'João Solicitante Caixa', cns: '111111111111111' } } }
    },
    {
      id: 2,
      type: 'Exame de Média Complexidade',
      consultation_date: '2026-06-20',
      status: 'Tramitando',
      owner: true,
      medical_professional: { name: 'Dr. Silva Médico' },
      back_to_owner: false,
      medical_status: false,
      social_status: true,
      report: { patient_care: { patient: { name: 'Maria Solicitante Tramitada', cns: '222222222222222' } } }
    },
    {
      id: 3,
      type: 'Cirurgia Eletiva',
      consultation_date: '2026-07-02',
      status: 'Outras Áreas',
      owner: false,
      medical_professional: false,
      back_to_owner: false,
      medical_status: false,
      social_status: false,
      report: { patient_care: { patient: { name: 'Carlos Outra Caixa', cns: '333333333333333' } } }
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    mockPatientRequestService = {
      getPatientRequests: vi.fn().mockReturnValue(of(mockPatientRequestsResponse))
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
                id: 10,
                roles: [{ permissions: [{ name: 'tfd/solicitação atualizar' }, { name: 'tfd/solicitação listar' }] }]
              }
            }
          }
        }
      }
    };

    // 2. Dynamic Import crucial para blindar o hoisting do Vitest sobre o BroadcastChannel stubado
    const { PatientRequestsPage } = await import('./patient-requests-page');

    await TestBed.configureTestingModule({
      imports: [PatientRequestsPage],
      providers: [
        { provide: PatientRequestService, useValue: mockPatientRequestService },
        { provide: MatDialog, useValue: mockMatDialog },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideEnvironmentNgxMask()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(PatientRequestsPage);
    component = fixture.componentInstance;

    // Fornece um mock do MatSort para satisfazer a query reativa viewChild.required
    const mockSortInstance = new MatSort();
    vi.spyOn(component, 'sort').mockReturnValue(mockSortInstance);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  // --- BLOCO 1: INICIALIZAÇÃO E TRIAGEM DE SINAIS ---
  describe('Inicialização', () => {
    it('deve criar o componente com sucesso', () => {
      expect(component).toBeTruthy();
    });

    it('deve carregar as requisições e separá-las em owner, process e others via computed signals', () => {
      fixture.detectChanges(); // Dispara ngOnInit e a primeira busca carregando modais de loading

      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(1);

      // Valida Aba 1: Minha Caixa (Owner)
      const ownerData = component['ownerDataSource']().data;
      expect(ownerData.length).toBe(1);
      expect(ownerData[0].name).toBe('João Solicitante Caixa');

      // Valida Aba 2: Tramitadas (Process)
      const processData = component['processDataSource']().data;
      expect(processData.length).toBe(1);
      expect(processData[0].name).toBe('Maria Solicitante Tramitada');

      // Valida Aba 3: Outras Caixas (Others)
      const othersData = component['othersDataSource']().data;
      expect(othersData.length).toBe(1);
      expect(othersData[0].name).toBe('Carlos Outra Caixa');
    });

    it('deve fechar o BroadcastChannel com sucesso no ciclo de destruição (ngOnDestroy)', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(broadcastChannelMock.close).toHaveBeenCalled();
    });
  });

  // --- BLOCO 2: REATIVIDADE DOS FILTROS ---
  describe('Filtros das Tabelas', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve aplicar e normalizar o filtro na listagem de Minha Caixa', () => {
      const mockEvent = { target: { value: '  JOÃO   ' } } as unknown as Event;
      component['applyOwnerFilter'](mockEvent);
      expect(component['ownerDataSource']().filter).toBe('joão');
    });

    it('deve aplicar e normalizar o filtro na listagem de Tramitadas', () => {
      const mockEvent = { target: { value: 'MARIA' } } as unknown as Event;
      component['applyProcessFilter'](mockEvent);
      expect(component['processDataSource']().filter).toBe('maria');
    });

    it('deve aplicar e normalizar o filtro na listagem de Outras Caixas', () => {
      const mockEvent = { target: { value: 'Carlos' } } as unknown as Event;
      component['applyOthersFilter'](mockEvent);
      expect(component['othersDataSource']().filter).toBe('carlos');
    });
  });

  // --- BLOCO 3: REGRAS INTERNAS E SEGURANÇA CONTRA PERMISSÕES ---
  describe('Validações de Status e Controle de Permissões', () => {
    it('deve retornar FALSE (Habilitado) se o usuário possuir o papel de acesso mapeado', () => {
      fixture.detectChanges();
      // O componente inverte a lógica: se possui a permissão, retorna false (desabilitado = false)
      const disabledState = component['checkPermissions']('tfd/solicitação atualizar');
      expect(disabledState).toBe(false);
    });

    it('deve retornar TRUE (Desabilitado) se o usuário NÃO possuir a permissão mapeada', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('tfd/solicitação deletar_inexistente');
      expect(disabledState).toBe(true);
    });

    it('deve validar o status se possuir parecer médico e social simultaneamente', () => {
      expect(component['checkStatus']({ medical_status: true, social_status: true })).toBe(true);
      expect(component['checkStatus']({ medical_status: false, social_status: true })).toBe(false);
    });
  });

  // --- BLOCO 4: INTERAÇÃO DE MODAIS COM REFRESH (INTERATIVAS) ---
  describe('Ações de Modais Interativas (Com Refresh e Broadcast)', () => {
    beforeEach(() => {
      mockPatientRequestService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve disparar abertura de modal e emitir alteração no barramento para "haltedPatientRequest"', async () => {
      fixture.detectChanges(); // 1ª chamada (Inicial do ngOnInit)
      component['haltedPatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      
      // 1 (do detectChanges) + 1 (do afterClosed direto) + 1 (do eco do onmessage do canal) = 3
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e emitir alteração no barramento para "updatePatientRequest"', async () => {
      fixture.detectChanges();
      component['updatePatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e emitir alteração no barramento para "deletePatientRequest"', async () => {
      fixture.detectChanges();
      component['deletePatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e emitir alteração no barramento para "processPatientRequest"', async () => {
      fixture.detectChanges();
      component['processPatientRequest'](mockPatientRequestsResponse[0]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e emitir alteração no barramento para "movePatientRequestFromProcesses"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromProcesses'](mockPatientRequestsResponse[1]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e emitir alteração no barramento para "movePatientRequestFromOthers"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromOthers'](mockPatientRequestsResponse[2]);
      
      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(3);
    });
  });

  // --- BLOCO 5: INTERAÇÃO DE MODAIS SEM REFRESH (VISUALIZAÇÃO) ---
  describe('Ações de Modais Passivas (Apenas Leitura/Visualização)', () => {
    beforeEach(() => {
      mockPatientRequestService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve abrir detalhes do fluxo sem recarregar ou disparar broadcast na "showPatientRequest"', async () => {
      fixture.detectChanges();
      component['showPatientRequest'](mockPatientRequestsResponse[0]);

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockPatientRequestService.getPatientRequests).toHaveBeenCalledTimes(1); // Somente o inicial do detectChanges
    });

    it('deve abrir anexos sem recarregar ou disparar broadcast na "patientRequestAttachments"', async () => {
      fixture.detectChanges();
      component['patientRequestAttachments'](mockPatientRequestsResponse[0]);

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });

    it('deve abrir a mensagem de desfazer sem recarregar ou disparar broadcast na "undoMessage"', async () => {
      fixture.detectChanges();
      component['undoMessage']('Mensagem explicativa de retorno de fluxo');

      await Promise.resolve();
      expect(mockMatDialog.open).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
    });
  });
});