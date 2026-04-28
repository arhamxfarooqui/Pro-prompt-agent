/**
 * Snippet Manager
 * Detects "@prefix" triggers in text fields and shows a snippet insertion UI.
 */

import type { Snippet } from '@lib/types/snippet.types';

export class SnippetManager {
  private activeElement: HTMLInputElement | HTMLTextAreaElement | HTMLElement | null = null;
  private popup: HTMLDivElement | null = null;
  private currentQuery: string = '';
  private snippets: Snippet[] = [];

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('keydown', this.handleKeydown.bind(this), true);
    document.addEventListener('click', (e) => {
      if (this.popup && !this.popup.contains(e.target as Node)) {
        this.closePopup();
      }
    });
  }

  private async handleInput(e: Event) {
    const target = e.target as HTMLElement;
    if (!this.isValidTarget(target)) return;
    this.activeElement = target;

    const text = this.getText(target);
    // Naive detection: if the last word starts with /
    const match = text.match(/(?:^|\s)(\/[a-zA-Z0-9_-]*)$/);
    if (match) {
      this.currentQuery = match[1];
      await this.showPopup(target, this.currentQuery);
    } else {
      this.closePopup();
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (!this.popup) return;
    if (e.key === 'Escape') {
      this.closePopup();
      e.preventDefault();
    }
  }

  private isValidTarget(el: HTMLElement): boolean {
    return (
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'INPUT' ||
      el.hasAttribute('contenteditable')
    );
  }

  private getText(el: HTMLElement): string {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return (el as HTMLInputElement).value;
    }
    return el.textContent || '';
  }

  private setText(el: HTMLElement, text: string) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      (el as HTMLInputElement).value = text;
    } else {
      el.textContent = text;
    }
    // Dispatch input event for React/Vue hooks
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private async fetchSnippets(query: string) {
    const cleanQuery = query.replace('/', '');
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SNIPPETS',
        payload: { query: cleanQuery }
      });
      if (response && response.status === 'success') {
        this.snippets = response.data;
      }
    } catch (err) {
      console.warn('[SnippetManager] Failed to fetch snippets', err);
    }
  }

  private async showPopup(target: HTMLElement, query: string) {
    await this.fetchSnippets(query);
    if (this.snippets.length === 0) {
      this.closePopup();
      return;
    }

    if (!this.popup) {
      this.popup = document.createElement('div');
      this.popup.id = 'pro-prompt-snippet-popup';
      this.popup.style.cssText = `
        position: absolute;
        z-index: 9999999;
        background: #0F172A;
        border: 1px solid #334155;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
        color: #F8FAFC;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px;
        min-width: 200px;
        max-width: 300px;
        max-height: 200px;
        overflow-y: auto;
      `;
      document.body.appendChild(this.popup);
    }

    // Position near bottom right of target bounding rect
    const rect = target.getBoundingClientRect();
    this.popup.style.top = `${window.scrollY + rect.bottom + 5}px`;
    this.popup.style.left = `${window.scrollX + rect.left}px`;

    this.popup.innerHTML = '';
    this.snippets.forEach((snippet) => {
      const item = document.createElement('div');
      item.style.cssText = `padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #1E293B; display: flex; flex-direction: column;`;
      item.onmouseover = () => (item.style.background = '#1E293B');
      item.onmouseout = () => (item.style.background = 'transparent');
      
      const title = document.createElement('span');
      title.style.cssText = `font-weight: 600; color: #3B82F6; margin-bottom: 2px;`;
      title.textContent = snippet.prefix;
      
      const desc = document.createElement('span');
      desc.style.cssText = `color: #94A3B8; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
      desc.textContent = snippet.description || snippet.body;

      item.appendChild(title);
      item.appendChild(desc);
      
      item.onmousedown = (e) => {
        e.preventDefault();
        this.injectSnippet(snippet);
      };
      
      this.popup.appendChild(item);
    });
  }

  private injectSnippet(snippet: Snippet) {
    if (!this.activeElement) return;
    
    let text = this.getText(this.activeElement);
    // Replace the last occurrence of the query with the snippet body
    const lastIdx = text.lastIndexOf(this.currentQuery);
    if (lastIdx !== -1) {
      text = text.substring(0, lastIdx) + snippet.body + text.substring(lastIdx + this.currentQuery.length);
      this.setText(this.activeElement, text);
    }

    this.closePopup();
  }

  private closePopup() {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }
}
