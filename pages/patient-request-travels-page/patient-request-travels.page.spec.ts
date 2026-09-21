import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TravelService } from '../../services/travel-service';
import { provideEnvironmentNgxMask } from 'ngx-mask';
import { NO_ERRORS_SCHEMA } from '@angular/core';

// 1. Estrutura de espionagem para isolar o barramento global do BroadcastChannel de passagens
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

describe('TravelsPage', () => {
  let component: any;
  let fixture: ComponentFixture<any>;
  
  let mockTravelService: any;
  let mockActivatedRoute: any;
  let dialogSpy: any;

  // Mock atualizado incluindo a nova regra de negócio do filtro: travel_professional
  const mockTravelRequestsResponse = [
    {
      id: 1,
      type: 'TFD - Terrestre',
      consultation_date: '2026-06-15',
      status: 'Pendente',
      travel_professional: {}, // 🌟 Atende à nova regra obrigatória do filtro
      is_travel_finished: false,
      travel: {}, // Entra em: Minha Caixa
      is_travel_bookmark: false,
      travel_status: true,
      back_to_travel: false,
      report: { patient_care: { patient: { name: 'João Passagem Caixa', cns: '111111111111111' } } }
    },
    {
      id: 2,
      type: 'TFD - Aéreo Intermunicipal',
      consultation_date: '2026-06-20',
      status: 'Finalizado',
      travel_professional: {}, // 🌟 Atende à nova regra obrigatória do filtro
      is_travel_finished: true,
      travel: {}, // Entra em: Finalizadas
      report: { 
        patient_care: { patient: { name: 'Maria Passagem Finalizada', cns: '222222222222222' } },
        medical_professional: { name: 'Dr. Silva Médico' }
      },
      medical_professional: { name: 'Dr. Silva Médico' }
    },
    {
      id: 3,
      type: 'TFD - Aéreo Interestadual',
      consultation_date: '2026-07-02',
      travel_professional: {}, // 🌟 Atende à nova regra obrigatória do filtro
      is_travel_finished: false,
      travel: null, // Entra em: Outras Caixas
      report: { 
        patient_care: { patient: { name: 'Carlos Outra Caixa Passagem', cns: '333333333333333' } }
      },
      owner_professional: { name: 'Enf. Souza Responsável' }
    }
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    canalCallback = null;

    mockTravelService = {
      getPatientRequests: vi.fn().mockReturnValue(of(mockTravelRequestsResponse))
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
                      { name: 'tfd/paciente acompanhantes' },
                      { name: 'tfd/passagem atualizar' }
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
    const { TravelsPage } = await import('./travels-page');

    await TestBed.configureTestingModule({
      imports: [TravelsPage],
      providers: [
        { provide: TravelService, useValue: mockTravelService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        provideEnvironmentNgxMask()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(TravelsPage);
    component = fixture.componentInstance;

    // ⚡ SOLUÇÃO DO PROBLEMA: Interceptamos o MatDialog real que foi injetado pelo componente standalone
    const realDialog = fixture.debugElement.injector.get(MatDialog);
    dialogSpy = vi.spyOn(realDialog, 'open').mockReturnValue({
      close: vi.fn(),
      afterClosed: vi.fn().mockReturnValue(of(true)),
      componentInstance: {}
    } as any);

    // Fornece um mock do MatSort para satisfazer a query reativa viewChild.required() do Signal
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

    it('deve buscar e separar as requisições de viagem corretamente através dos computeds', () => {
      fixture.detectChanges(); // Dispara ngOnInit e ativa a busca com loading

      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(1);

      // Aba 1: Minha Caixa
      const ownerData = component['ownerDataSource']().data;
      expect(ownerData.length).toBe(1);
      expect(ownerData[0].name).toBe('João Passagem Caixa');

      // Aba 2: Finalizadas
      const finishData = component['finishDataSource']().data;
      expect(finishData.length).toBe(1);
      expect(finishData[0].name).toBe('Maria Passagem Finalizada');

      // Aba 3: Outras Caixas
      const othersData = component['othersDataSource']().data;
      expect(othersData.length).toBe(1);
      expect(othersData[0].name).toBe('Carlos Outra Caixa Passagem');
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

    it('deve formatar e injetar o filtro local na listagem de Finalizadas', () => {
      const mockEvent = { target: { value: 'MARIA' } } as unknown as Event;
      component['applyFinishFilter'](mockEvent);
      expect(component['finishDataSource']().filter).toBe('maria');
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
      const disabledState = component['checkPermissions']('tfd/paciente acompanhantes');
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
      mockTravelService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "haltedPatientRequest"', async () => {
      fixture.detectChanges(); 
      component['haltedPatientRequest'](mockTravelRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(3); 
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "undoPatientRequest"', async () => {
      fixture.detectChanges();
      component['undoPatientRequest'](mockTravelRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "finishPatientRequestTravel"', async () => {
      fixture.detectChanges();
      component['finishPatientRequestTravel'](mockTravelRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "movePatientRequestFromFinished"', async () => {
      fixture.detectChanges();
      component['movePatientRequestFromFinished'](mockTravelRequestsResponse[1]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(3);
    });

    it('deve disparar abertura de modal e ecoar alteração de fluxo para "patientRequestTravels"', async () => {
      fixture.detectChanges();
      component['patientRequestTravels'](mockTravelRequestsResponse[0]);
      
      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).toHaveBeenCalledWith('update');
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(3);
    });
  });

  // --- BLOCO 5: INTERAÇÃO DE MODAIS PASSIVAS (APENAS LEITURA / VISUALIZAÇÃO) ---
  describe('Ações de Modais Passivas (Apenas Leitura/Visualização)', () => {
    beforeEach(() => {
      mockTravelService.getPatientRequests.mockClear();
      broadcastChannelMock.postMessage.mockClear();
    });

    it('deve abrir detalhes do fluxo sem recarregar ou emitir broadcast em "showPatientRequest"', async () => {
      fixture.detectChanges();
      component['showPatientRequest'](mockTravelRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(1); 
    });

    it('deve abrir anexos sem recarregar ou emitir broadcast em "patientRequestAttachments"', async () => {
      fixture.detectChanges();
      component['patientRequestAttachments'](mockTravelRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve abrir lista de acompanhantes sem recarregar ou emitir broadcast em "patientEscorts"', async () => {
      fixture.detectChanges();
      component['patientEscorts'](mockTravelRequestsResponse[0]);

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(1);
    });

    it('deve abrir visualização de mensagem sem recarregar ou emitir broadcast em "undoMessage"', async () => {
      fixture.detectChanges();
      component['undoMessage']('Mensagem explicativa de cancelamento de passagem');

      await Promise.resolve();
      expect(dialogSpy).toHaveBeenCalled();
      expect(broadcastChannelMock.postMessage).not.toHaveBeenCalled();
      expect(mockTravelService.getPatientRequests).toHaveBeenCalledTimes(1);
    });
  });
});