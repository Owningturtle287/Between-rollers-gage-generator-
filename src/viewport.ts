/** Keep the whole editor inside the visible viewport above the mobile keyboard. */
export function bindViewport(){
  const root=document.documentElement,viewport=window.visualViewport;
  let raf=0;
  const sync=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const height=viewport?.height??window.innerHeight;
      root.style.setProperty('--app-height',`${height}px`);
      root.style.setProperty('--app-top',`${viewport?.offsetTop??0}px`);
      const editing=!!document.activeElement?.matches('input:not([type=color]):not([type=checkbox]):not([type=range]),textarea,select');
      root.classList.toggle('keyboard-open',editing&&window.innerHeight-height>100);
    });
  };
  sync();window.addEventListener('resize',sync);viewport?.addEventListener('resize',sync);viewport?.addEventListener('scroll',sync);
  document.addEventListener('focusin',sync);document.addEventListener('focusout',sync);
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',sync);viewport?.removeEventListener('resize',sync);viewport?.removeEventListener('scroll',sync);document.removeEventListener('focusin',sync);document.removeEventListener('focusout',sync);};
}
