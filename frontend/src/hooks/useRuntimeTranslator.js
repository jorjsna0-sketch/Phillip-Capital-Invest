import { useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import UI_DICT from '../i18n/uiDictionary';

/**
 * Runtime DOM translator.
 * Observes the DOM and translates hardcoded Russian text nodes + placeholders
 * to the currently selected UI language (tr / en) using UI_DICT.
 *
 * This is a pragmatic solution for a large pre-existing codebase that has
 * many hardcoded Russian strings spread across components. It lets us
 * localize the whole UI without rewriting every component.
 *
 * - Only runs when language !== 'ru' (original strings are already Russian).
 * - Targets Text nodes (safe: won't touch React state / event handlers).
 * - Translates `placeholder`, `title`, and `aria-label` attributes too.
 * - Uses a MutationObserver to handle dynamically rendered content.
 */

function translateText(text, lang) {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;
  // Only ASCII digits/numbers — skip
  if (/^[\d\s.,+\-%$₺€₮]+$/.test(trimmed)) return text;

  // Fast path: exact match
  const entry = UI_DICT[trimmed];
  if (entry) {
    // For RU lang, we want to keep original Russian key (since dict keys ARE Russian)
    // unless an explicit `ru` value is provided.
    const tr = lang === 'ru' ? (entry.ru || trimmed) : (entry[lang] || entry.en);
    if (tr && tr !== trimmed) {
      return text.replace(trimmed, tr);
    }
    return text;
  }

  // Partial/phrase match
  let result = text;
  let changed = false;
  const keys = Object.keys(UI_DICT).sort((a, b) => b.length - a.length);
  for (const src of keys) {
    if (src.length < 3) continue;
    if (result.includes(src)) {
      const tr = lang === 'ru' ? (UI_DICT[src].ru || src) : (UI_DICT[src][lang] || UI_DICT[src].en);
      if (tr && tr !== src) {
        result = result.split(src).join(tr);
        changed = true;
      }
    }
  }
  return changed ? result : text;
}

function translateAttributes(element, lang) {
  const attrs = ['placeholder', 'title', 'aria-label', 'alt'];
  for (const attr of attrs) {
    const val = element.getAttribute && element.getAttribute(attr);
    if (val) {
      const translated = translateText(val, lang);
      if (translated !== val) {
        element.setAttribute(attr, translated);
      }
    }
  }
}

function walkAndTranslate(root, lang) {
  if (!root) return;

  // Walk text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Skip scripts/styles
      const parent = node.parentNode;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tagName = parent.nodeName;
      if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'TEXTAREA' || tagName === 'INPUT') {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip contenteditable
      if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
      // Skip empty
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);

  nodes.forEach((node) => {
    const translated = translateText(node.nodeValue, lang);
    if (translated !== node.nodeValue) {
      node.nodeValue = translated;
    }
  });

  // Walk elements for attributes
  if (root.querySelectorAll) {
    const els = root.querySelectorAll('[placeholder], [title], [aria-label], [alt]');
    els.forEach((el) => translateAttributes(el, lang));
    // Also root itself
    if (root.getAttribute) translateAttributes(root, lang);
  }
}

export function useRuntimeTranslator() {
  const { language } = useLanguage();
  const observerRef = useRef(null);

  useEffect(() => {
    // Disconnect any previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Initial full-page pass (covers tr/en/ru so English hardcoded strings
    // get translated to the active language)
    // Use document.body so we also cover React portals (Radix dialogs, toasts,
    // dropdown menus) that render outside #root.
    const rootEl = document.body;
    walkAndTranslate(rootEl, language);

    // Observe future DOM mutations
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // New nodes added
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            walkAndTranslate(node, language);
          } else if (node.nodeType === Node.TEXT_NODE) {
            const translated = translateText(node.nodeValue, language);
            if (translated !== node.nodeValue) node.nodeValue = translated;
          }
        });
        // characterData changed
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          const translated = translateText(mutation.target.nodeValue, language);
          if (translated !== mutation.target.nodeValue) {
            mutation.target.nodeValue = translated;
          }
        }
        // attribute changes (placeholder etc.)
        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          translateAttributes(mutation.target, language);
        }
      }
    });

    observer.observe(rootEl, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label', 'alt']
    });

    observerRef.current = observer;

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [language]);
}

export default useRuntimeTranslator;
