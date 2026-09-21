import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { CostAssistanceService } from '../../services/cost-assistance-service';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// 1. Estrutura de espionagem para isolar o barramento global do BroadcastChannel de ajuda de custo
const broadcastChannelMock = {
  postMessage: vi.fn(),
  close: vi.fn()
};

let canalCallback: any = null;

// Stub do canal antes de carregar o componente para evitar vazamento de memória e interações colaterais
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

describe('CostAssistancesPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;
  
  let mockCostAssistanceService: any;
  let mockActivatedRoute: any;
  let dialogSpy: any;

  // Massa de dados configurada estritamente com as chaves lógicas de Ajuda de Custo
  const mockCostRequestsResponse = [
    {
      id: 1,
      type: 'TFD - Ajuda de Custo Alimentação',
      consultation_date: '2026-06-15',
      status: 'Pendente',
      cost_assistance: {}, 
      payment_professional: null, // (!payment_professional && cost_assistance) -> Entra em: Minha Caixa
      back_to_cost_assistance: false,
      is_cost_assistance_bookmark: false,
      cost_assistance_status: true,
      report: { patient_care: { patient: { name: 'João Ajuda Caixa', cns: '111111111111111' } } }
    },
    {
      id: 2,
      type: 'TFD - Ajuda de Custo Hospedagem',
      consultation_date: '2026-06-20',
      status: 'Tramitado',
      cost_assistance: {}, 
      payment_professional: { name: 'Profissional de Pagamento' }, // (payment_professional && cost_assistance && !back) -> Entra em: Tramitadas
      back_to_cost_assistance: false,
      report: { patient_care: { patient: { name: 'Maria Ajuda Tramitada', cns: '222222222222222' } } }
    },
    {
      id: 3,
      type: 'TFD - Tratamento Fora do Domicílio',
      consultation_date: '2026-07-02',
      cost_assistance: null, // (!cost_assistance) -> Entra em: Outras Caixas (Aguardando)
      payment_professional: { name: 'Outro Profissional' },
      report: { patient_care: { patient: { name: 'Carlos Outra Caixa Ajuda', cns: '333333333333333' } } }
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    mockCostAssistanceService = {
      getPatientRequests: vi.fn().mockReturnValue(of(mockCostRequestsResponse))
    };

    mockActivatedRoute = {
      parent: {
        parent: {
          snapshot: {
            data: {
              user: {
                id: 10,
                roles: [
                  { 
                    permissions: [
                      { name: 'tfd/solicitação anexos' }, 
                      { name: 'tfd/ajuda de custo atualizar' },
                      { name: 'tfd/ajuda de custo listar' }
                    ] 
                  }
                ]
              }
            }
          }
        }
      }
    };

    // Import dinâmico do componente standalone
    const { CostAssistancesPage } = await import('./cost-assistances-page');

    await TestBed.configureTestingModule({
      imports: [CostAssistancesPage],
      providers: [
        { provide: CostAssistanceService, useValue: mockCostAssistanceService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideEnvironmentNgxMask()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(CostAssistancesPage);
    component = fixture.componentInstance;

    // Intercepta e espiona o MatDialog injetado no escopo do componente
    const realDialog = fixture.debugElement.injector.get(MatDialog);
    dialogSpy = vi.spyOn(realDialog, 'open').mockReturnValue({
      close: vi.fn(),
      afterClosed: vi.fn().mockReturnValue(of(true)),
      componentInstance: {}
    } as any);

    // Provê um mock do MatSort para satisfazer a viewChild reativa obrigatória
    const mockSortInstance = new MatSort();
    vi.spyOn(component, 'sort').mockReturnValue(mockSortInstance);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
  });

  // --- BLOCO 1: INICIALIZAÇÃO E TRIAGEM DE SINAIS (COMPUTED SIGNALS) ---
  describe('Inicialização', () => {
    it('deve criar o componente com sucesso', () => {
      expect(component).toBeTruthy();
    });

    it('deve buscar e separar as requisições de ajuda de custo corretamente através dos computeds', () => {
      fixture.detectChanges(); // Dispara ngOnInit e ativa a busca

      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(1);

      // Aba 1: Minha Caixa (owner)
      const ownerData = component['ownerDataSource']().data;
      expect(ownerData.length).toBe(1);
      expect(ownerData[0].name).toBe('João Ajuda Caixa');

      // Aba 2: Tramitadas (process)
      const processData = component['processDataSource']().data;
      expect(processData.length).toBe(1);
      expect(processData[0].name).toBe('Maria Ajuda Tramitada');

      // Aba 3: Outras Caixas (others)
      const othersData = component['othersDataSource']().data;
      expect(othersData.length).toBe(1);
      expect(othersData[0].name).toBe('Carlos Outra Caixa Ajuda');
    });

    it('deve fechar a conexão do BroadcastChannel no encerramento (ngOnDestroy)', () => {
      fixture.detectChanges();
      component.ngOnDestroy();
      expect(broadcastChannelMock.close).toHaveBeenCalled();
    });
  });

  // --- BLOCO 2: REATIVIDADE DOS FILTROS LOCALIZADOS ---
  describe('Filtros das Tabelas', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('deve formatar e injetar o filtro local na listagem de Minha Caixa', () => {
      const mockEvent = { target: { value: '  JOÃO   ' } } as unknown as Event;
      component['applyOwnerFilter'](mockEvent);
      expect(component['ownerDataSource']().filter).toBe('joão');
    });

    it('deve formatar e injetar o filtro local na listagem de Tramitadas', () => {
      const mockEvent = { target: { value: 'MARIA' } } as unknown as Event;
      component['applyProcessFilter'](mockEvent);
      expect(component['processDataSource']().filter).toBe('maria');
    });

    it('deve formatar e injetar o filtro local na listagem de Outras Caixas', () => {
      const mockEvent = { target: { value: 'Carlos' } } as unknown as Event;
      component['applyOthersFilter'](mockEvent);
      expect(component['othersDataSource']().filter).toBe('carlos');
    });
  });

  // --- BLOCO 3: SEGURANÇA E INVERSÃO DE PERMISSÕES ---
  describe('Controle de Permissões e Status', () => {
    it('deve retornar FALSE (Habilitado) se o usuário carregar o papel mapeado', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('tfd/ajuda de custo atualizar');
      expect(disabledState).toBe(false);
    });

    it('deve retornar TRUE (Desabilitado) se o usuário NÃO possuir a permissão mapeada', () => {
      fixture.detectChanges();
      const disabledState = component['checkPermissions']('permissao/inexistente_tfd');
      expect(disabledState).toBe(true);
    });

    it('deve validar o status se houver parecer médico e parecer social simultâneos', () => {
      expect(component['checkStatus']({ medical_status: true, social_status: true })).toBe(true);
      expect(component['checkStatus']({ medical_status: false, social_status: true })).toBe(false);
    });
  });

  // --- BLOCO 4: INTERAÇÃO DE MODAIS INTERATIVAS (COM REFRESH E BROADCAST) ---
  describe('Ações de Modais Interativas (Com Atualização e Sincronismo)', () => {
    beforeEach(() => {
      mockCostAssistanceService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "haltedPatientRequest"', async () => {
      fixture.detectChanges(); 
      component['haltedPatientRequest'](mockCostRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "costAssistances"', async () => {
      fixture.detectChanges(); 
      component['costAssistances'](mockCostRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "undoPatientRequest"', async () => {
      fixture.detectChanges();
      component['undoPatientRequest'](mockCostRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "processPatientRequest"', async () => {
      fixture.detectChanges();
      component['processPatientRequest'](mockCostRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "movePatientRequestFromProcesses"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromProcesses'](mockCostRequestsResponse[1]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "movePatientRequestFromOthers"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromOthers'](mockCostRequestsResponse[2]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(3);
    });
  });

  // --- BLOCO 5: INTERAÇÃO DE MODAIS PASSIVAS (APENAS LEITURA / VISUALIZAÇÃO) ---
  describe('Ações de Modais Passivas (Apenas Leitura/Visualização)', () => {
    beforeEach(() => {
      mockCostAssistanceService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve abrir detalhes do fluxo sem recarregar ou emitir broadcast em "showPatientRequest"', async () => {
      fixture.detectChanges();
      component['showPatientRequest'](mockCostRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(1); 
    });

    it('deve abrir anexos sem recarregar ou emitir broadcast em "patientRequestAttachments"', async () => {
      fixture.detectChanges();
      component['patientRequestAttachments'](mockCostRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve abrir histórico sem recarregar ou emitir broadcast em "history"', async () => {
      fixture.detectChanges();
      component['history'](mockCostRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve abrir visualização de mensagem de retorno sem recarregar ou emitir broadcast em "undoMessage"', async () => {
      fixture.detectChanges();
      component['undoMessage']('Mensagem de estorno do lote de pagamento');

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockCostAssistanceService.getPatientRequests).toHaveBeenCalledTimes(1);
    });
  });
});