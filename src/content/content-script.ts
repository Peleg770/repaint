// src/content/content-script.ts
// Mounts / unmounts the Repaint panel in response to toolbar toggle.
// esbuild bundles panel/main into this IIFE at build time — boot() is only
// called when the user clicks the toolbar icon.

import { boot } from '../panel/main';

let mounted = false;

chrome.runtime.onMessage.addListener((msg: { type: string }) => {
  if (msg.type !== 'TOGGLE') return;
  if (mounted) {
    document.getElementById('repaint-host')?.remove();
    mounted = false;
  } else {
    boot();
    mounted = true;
  }
});
