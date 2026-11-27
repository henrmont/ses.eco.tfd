// src/app/tfd/pages/settings-page/settings.page.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let component: SettingsPage;

  async function initPage(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [SettingsPage],
    })
      .overrideComponent(SettingsPage, {
        set: { template: '' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    fixture?.destroy();
  });

  it('deve criar a instância de SettingsPage sem erros', async () => {
    await initPage();

    expect(component).toBeTruthy();
  });
});