// src/app/tfd/components/users/user-detail/user-detail.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideNgxMask } from 'ngx-mask';
import { beforeEach, describe, expect, it } from 'vitest';

import { UserDetailComponent, UserDetailDialogData } from './user-detail.component';
import { TfdUser as User } from '../../../models/user.model';

describe('UserDetailComponent', () => {
  let component: UserDetailComponent;
  let fixture: ComponentFixture<UserDetailComponent>;

  const mockUser: User = {
    id: 15,
    name: 'Ana Paula',
    email: 'ana.paula@saude.gov.br',
    professional: {
      name: 'Dra. Ana Paula',
      types: ['MEDICO', { type: 'ASSISTENTE_SOCIAL' }],
    },
  } as unknown as User;

  async function createComponent(dialogData: UserDetailDialogData | null): Promise<void> {
    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [UserDetailComponent],
        providers: [
          provideNgxMask(),
          { provide: 'AnimationModuleType', useValue: 'NoopAnimations' },
          { provide: MAT_DIALOG_DATA, useValue: dialogData },
        ],
      })
      .overrideComponent(UserDetailComponent, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(UserDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await createComponent({ user: mockUser });
  });

  it('deve criar o componente com os dados recebidos em MAT_DIALOG_DATA', () => {
    expect(component).toBeTruthy();
    expect(component['user']).toEqual(mockUser);
    expect(component['professional']).toEqual(mockUser.professional);
  });

  describe('Getters user e professional', () => {
    it('deve retornar undefined quando MAT_DIALOG_DATA for null ou não tiver user', async () => {
      await createComponent(null);
      expect(component['user']).toBeUndefined();
      expect(component['professional']).toBeUndefined();

      await createComponent({});
      expect(component['user']).toBeUndefined();
      expect(component['professional']).toBeUndefined();
    });

    it('deve retornar undefined em professional quando user não possuir professional', async () => {
      await createComponent({
        user: { id: 99, name: 'Sem Profissional' } as unknown as User,
      });

      expect(component['user']?.id).toBe(99);
      expect(component['professional']).toBeUndefined();
    });
  });

  describe('Getter professionalTypes', () => {
    it('deve normalizar tipos mistos (strings e objetos com propriedade type) para string[]', () => {
      expect(component['professionalTypes']).toEqual(['MEDICO', 'ASSISTENTE_SOCIAL']);
    });

    it('deve retornar array vazio quando professional ou types estiverem ausentes', async () => {
      await createComponent({
        user: { id: 15, name: 'Ana Paula', professional: {} } as unknown as User,
      });
      expect(component['professionalTypes']).toEqual([]);

      await createComponent({
        user: { id: 15, name: 'Ana Paula' } as unknown as User,
      });
      expect(component['professionalTypes']).toEqual([]);

      await createComponent(null);
      expect(component['professionalTypes']).toEqual([]);
    });

    it('deve retornar array vazio quando types não for um array', async () => {
      await createComponent({
        user: {
          id: 15,
          professional: { types: 'MEDICO' },
        } as unknown as User,
      });

      expect(component['professionalTypes']).toEqual([]);
    });
  });
});